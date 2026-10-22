import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";

// Standard PDF fonts only cover WinAnsi (Latin-1-ish). Map the symbols we use,
// and replace anything else (e.g. Devanagari names) with "?" rather than crash.
const SUBST: Record<string, string> = { "₂": "2", "—": "-", "–": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "..." };
function safe(s: string | null | undefined) {
  return (s ?? "")
    .replace(/[\r\t]/g, " ")
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, (c) => SUBST[c] ?? "?");
}

export type PrescriptionData = {
  clinic: { name: string; addressText: string | null; timezone: string };
  doctor: { name: string; specialty: string; qualification: string | null; registrationNo: string | null };
  patient: {
    name: string | null;
    uhid: string | null;
    waPhone: string;
    dob: Date | null;
    gender: string | null;
    allergies: string | null;
  };
  visit: {
    token: number;
    checkedInAt: Date;
    completedAt: Date;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    pulse: number | null;
    spo2: number | null;
    temperatureC: number | null;
    respRate: number | null;
    weightKg: number | null;
    chiefComplaint: string | null;
    examination: string | null;
    diagnosis: string | null;
    icdCode?: string | null;
    advice: string | null;
    followUpDate: Date | null;
  };
  items: {
    medicine: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
  }[];
};

const A4: [number, number] = [595.28, 841.89];
const M = 48; // margin
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.45, 0.52);
const RED = rgb(0.7, 0.1, 0.1);
const TEAL = rgb(0.047, 0.51, 0.463); // brand-600

class Writer {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont
  ) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - M;
  }
  ensure(h: number) {
    if (this.y - h < M + 40) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - M;
    }
  }
  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (let word of para.split(/\s+/)) {
        // Hard-break a single token wider than the column (URLs, pasted codes).
        while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
          let cut = word.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width) cut--;
          if (line) lines.push(line);
          lines.push(word.slice(0, cut));
          line = "";
          word = word.slice(cut);
        }
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }
  text(s: string, opts: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; width?: number } = {}) {
    const { x = M, size = 10, font = this.font, color = INK, width = A4[0] - M - x } = opts;
    for (const line of this.wrap(s, font, size, width)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= size + 4;
    }
  }
  /** "Label: value" paragraph with a bold label. */
  field(label: string, value: string | null | undefined) {
    if (!value) return;
    const size = 10;
    const lw = this.bold.widthOfTextAtSize(`${label}: `, size);
    this.ensure(size + 4);
    this.page.drawText(`${label}:`, { x: M, y: this.y - size, size, font: this.bold, color: INK });
    this.text(value, { x: M + lw, size });
    this.y -= 2;
  }
  rule(thickness = 0.5, color = rgb(0.8, 0.82, 0.86)) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness, color });
    this.y -= 8;
  }
  gap(h: number) {
    this.y -= h;
  }
}

export async function renderPrescriptionPdf(d: PrescriptionData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`Prescription - ${d.patient.name ?? d.patient.uhid ?? ""}`));
  doc.setProducer("DocSlot HMS");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  const tz = d.clinic.timezone;
  const right = (s: string, size: number, f: PDFFont, color = INK) => {
    const t = safe(s);
    w.page.drawText(t, { x: A4[0] - M - f.widthOfTextAtSize(t, size), y: w.y - size, size, font: f, color });
  };

  // Header: hospital left, doctor right
  const top = w.y;
  w.text(d.clinic.name, { size: 16, font: bold, width: 280, color: TEAL });
  if (d.clinic.addressText) w.text(d.clinic.addressText, { size: 9, color: MUTED, width: 280 });
  const leftBottom = w.y;
  w.y = top;
  right(d.doctor.name, 11, bold);
  w.y -= 15;
  right([d.doctor.qualification, d.doctor.specialty].filter(Boolean).join(" · "), 9, font, MUTED);
  w.y -= 13;
  if (d.doctor.registrationNo) {
    right(`Reg. no. ${d.doctor.registrationNo}`, 9, font, MUTED);
    w.y -= 13;
  }
  w.y = Math.min(w.y, leftBottom) - 4;
  w.rule(1.5, TEAL);

  // Patient block
  const meta = patientMeta(d.patient);
  const rowY = w.y;
  w.text(`Patient: ${d.patient.name ?? "-"}${meta ? ` (${meta})` : ""}`, { size: 10, font: bold, width: 330 });
  w.text(`UHID: ${d.patient.uhid ?? "-"}   Phone: +${d.patient.waPhone}`, { size: 9, color: MUTED, width: 330 });
  const after = w.y;
  w.y = rowY;
  right(`Date: ${fmt(d.visit.completedAt, tz, "d MMM yyyy")}`, 9, font);
  w.y -= 13;
  right(`OPD token #${d.visit.token}`, 9, font, MUTED);
  w.y = Math.min(after, w.y - 13);
  if (d.patient.allergies) w.text(`ALLERGIES: ${d.patient.allergies}`, { size: 10, font: bold, color: RED });
  w.gap(2);
  w.rule();

  // Vitals
  const v = d.visit;
  const vitals = [
    v.bpSystolic != null && v.bpDiastolic != null && `BP ${v.bpSystolic}/${v.bpDiastolic} mmHg`,
    v.pulse != null && `Pulse ${v.pulse}/min`,
    v.spo2 != null && `SpO2 ${v.spo2}%`,
    v.temperatureC != null && `Temp ${v.temperatureC} °C`,
    v.respRate != null && `RR ${v.respRate}/min`,
    v.weightKg != null && `Wt ${v.weightKg} kg`,
  ].filter(Boolean) as string[];
  if (vitals.length) {
    w.text(vitals.join("    "), { size: 9 });
    w.gap(2);
    w.rule();
  }

  w.field("Complaint", v.chiefComplaint);
  w.field("Findings", v.examination);
  w.field("Diagnosis", v.diagnosis ? `${v.diagnosis}${v.icdCode ? `  (ICD-10 ${v.icdCode})` : ""}` : null);
  w.gap(6);

  // Rx table
  w.text("Rx", { size: 18, font: bold, color: TEAL });
  w.gap(2);
  if (d.items.length === 0) {
    w.text("No medicines prescribed.", { color: MUTED });
  } else {
    const cols = [
      { h: "#", x: M, w: 16 },
      { h: "Medicine", x: M + 18, w: 150 },
      { h: "Dose", x: M + 172, w: 64 },
      { h: "Frequency", x: M + 240, w: 64 },
      { h: "Duration", x: M + 308, w: 60 },
      { h: "Instructions", x: M + 372, w: A4[0] - M - (M + 372) },
    ];
    w.ensure(14);
    for (const c of cols) w.page.drawText(c.h, { x: c.x, y: w.y - 9, size: 8, font: bold, color: MUTED });
    w.y -= 13;
    w.rule(0.75);
    d.items.forEach((it, i) => {
      const cells = [String(i + 1), it.medicine, it.dosage, it.frequency, it.duration, it.instructions];
      const wrapped = cells.map((c, ci) => w.wrap(c ?? "", ci === 1 ? bold : font, 9, cols[ci].w));
      const h = Math.max(...wrapped.map((l) => l.length)) * 12;
      w.ensure(h + 6);
      wrapped.forEach((lines, ci) =>
        lines.forEach((line, li) =>
          w.page.drawText(line, { x: cols[ci].x, y: w.y - 9 - li * 12, size: 9, font: ci === 1 ? bold : font, color: INK })
        )
      );
      w.y -= h + 4;
    });
    w.rule();
  }

  w.gap(4);
  w.field("Advice", v.advice);
  if (v.followUpDate) w.field("Follow-up", fmt(v.followUpDate, "UTC", "EEEE, d MMM yyyy"));

  // Signature
  w.ensure(70);
  w.gap(48);
  const sx = A4[0] - M - 160;
  w.page.drawLine({ start: { x: sx, y: w.y }, end: { x: A4[0] - M, y: w.y }, thickness: 0.5, color: MUTED });
  const sig = safe(d.doctor.name);
  w.page.drawText(sig, { x: sx + (160 - font.widthOfTextAtSize(sig, 9)) / 2, y: w.y - 12, size: 9, font, color: MUTED });

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const f = safe(`Generated ${fmt(d.visit.completedAt, tz, "d MMM yyyy, h:mm a")} · DocSlot HMS · Page ${i + 1} of ${pages.length}`);
    p.drawText(f, { x: M, y: M - 20, size: 7, font, color: MUTED });
  });

  return doc.save();
}
