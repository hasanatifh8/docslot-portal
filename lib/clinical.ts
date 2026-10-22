// Clinical rules shared by triage, consultation and summaries.
// Pure module — safe for client components (used for live validation).

export type VitalKey = "bpSystolic" | "bpDiastolic" | "pulse" | "spo2" | "temperatureC" | "respRate" | "heightCm" | "weightKg";

export type Flag = "ok" | "low" | "high" | "critical";

type Range = {
  label: string;
  unit: string;
  /** Hard limits — outside these the value is a typo, not a patient. */
  min: number;
  max: number;
  /** Normal adult band; outside = abnormal (amber). */
  normal?: [number, number];
  /** Outside = critical (red). */
  critical?: [number, number];
  step?: number;
};

export const VITAL_RANGES: Record<VitalKey, Range> = {
  bpSystolic: { label: "BP systolic", unit: "mmHg", min: 50, max: 260, normal: [90, 139], critical: [80, 180] },
  bpDiastolic: { label: "BP diastolic", unit: "mmHg", min: 30, max: 160, normal: [60, 89], critical: [50, 120] },
  pulse: { label: "Pulse", unit: "bpm", min: 20, max: 250, normal: [60, 100], critical: [40, 140] },
  spo2: { label: "SpO₂", unit: "%", min: 50, max: 100, normal: [95, 100], critical: [90, 100] },
  temperatureC: { label: "Temperature", unit: "°C", min: 30, max: 45, normal: [36.1, 37.5], critical: [35, 39.5], step: 0.1 },
  respRate: { label: "Resp. rate", unit: "/min", min: 5, max: 60, normal: [12, 20], critical: [8, 30] },
  heightCm: { label: "Height", unit: "cm", min: 20, max: 250, step: 0.1 },
  weightKg: { label: "Weight", unit: "kg", min: 0.5, max: 400, step: 0.1 },
};

/** Classify one reading. `invalid` = outside physiological limits (block save). */
export function flagVital(key: VitalKey, value: number | null | undefined): Flag | "invalid" | null {
  if (value == null || Number.isNaN(value)) return null;
  const r = VITAL_RANGES[key];
  if (value < r.min || value > r.max) return "invalid";
  if (r.critical && (value < r.critical[0] || value > r.critical[1])) return "critical";
  if (r.normal && value < r.normal[0]) return "low";
  if (r.normal && value > r.normal[1]) return "high";
  return "ok";
}

export const FLAG_TEXT: Record<Exclude<Flag, "ok">, string> = { low: "Low", high: "High", critical: "Critical" };

export function bmi(heightCm: number | null, weightKg: number | null) {
  if (!heightCm || !weightKg) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export function bmiBand(b: number | null) {
  if (b == null) return null;
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Normal";
  if (b < 30) return "Overweight";
  return "Obese";
}

// ─── Allergy check ───────────────────────────────────────────────────────

// Drug-class keywords: an allergy to the class matches any member.
const CLASS_MEMBERS: Record<string, string[]> = {
  penicillin: ["amoxicillin", "ampicillin", "penicillin", "cloxacillin", "augmentin", "amoxyclav", "piperacillin"],
  sulfa: ["sulfamethoxazole", "cotrimoxazole", "septran", "sulfasalazine"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aceclofenac", "aspirin", "ketorolac", "etoricoxib", "mefenamic"],
  aspirin: ["aspirin", "ecosprin"],
  cephalosporin: ["cefixime", "ceftriaxone", "cefuroxime", "cefpodoxime", "cephalexin", "cefadroxil"],
  quinolone: ["ciprofloxacin", "levofloxacin", "ofloxacin", "norfloxacin", "moxifloxacin"],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin"],
};

/** Returns the allergy term that the medicine conflicts with, if any. */
export function allergyConflict(medicine: string, allergies: string | null | undefined): string | null {
  if (!allergies || !medicine.trim()) return null;
  const med = medicine.toLowerCase();
  const terms = allergies
    .toLowerCase()
    .split(/[,;/\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  for (const term of terms) {
    if (med.includes(term)) return term;
    for (const [cls, members] of Object.entries(CLASS_MEMBERS)) {
      if (term.includes(cls) && members.some((m) => med.includes(m))) return term;
    }
  }
  return null;
}

// ─── Automated clinical summary ──────────────────────────────────────────

type SummaryInput = {
  patient: { name: string | null; age: number | null; gender: string | null; allergies?: string | null; chronicConditions?: string | null };
  visitType?: string | null;
  vitals: Partial<Record<VitalKey, number | null>>;
  chiefComplaint?: string | null;
  history?: string | null;
  examination?: string | null;
  diagnosis?: string | null;
  icdCode?: string | null;
  items: { medicine: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
  advice?: string | null;
  followUp?: string | null; // preformatted date
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** One-paragraph narrative a doctor can read in five seconds. */
export function clinicalSummary(d: SummaryInput) {
  const who = [
    d.patient.age != null ? `${d.patient.age}-year-old` : null,
    d.patient.gender ?? "patient",
  ]
    .filter(Boolean)
    .join(" ");
  const parts: string[] = [];
  parts.push(
    `${who.charAt(0).toUpperCase()}${who.slice(1)}${d.visitType === "follow_up" ? " (follow-up visit)" : ""}${
      clean(d.chiefComplaint) ? ` presenting with ${clean(d.chiefComplaint).replace(/\.$/, "")}` : ""
    }.`
  );
  if (clean(d.patient.chronicConditions)) parts.push(`Known ${clean(d.patient.chronicConditions)}.`);
  if (clean(d.patient.allergies)) parts.push(`Allergic to ${clean(d.patient.allergies)}.`);

  const v = d.vitals;
  const vit: string[] = [];
  const tag = (k: VitalKey, val: number | null | undefined) => {
    const f = flagVital(k, val);
    return f && f !== "ok" && f !== "invalid" ? ` (${FLAG_TEXT[f].toLowerCase()})` : "";
  };
  if (v.bpSystolic != null && v.bpDiastolic != null) {
    const worst = [flagVital("bpSystolic", v.bpSystolic), flagVital("bpDiastolic", v.bpDiastolic)];
    const t = worst.includes("critical") ? " (critical)" : worst.includes("high") ? " (high)" : worst.includes("low") ? " (low)" : "";
    vit.push(`BP ${v.bpSystolic}/${v.bpDiastolic}${t}`);
  }
  if (v.pulse != null) vit.push(`pulse ${v.pulse}${tag("pulse", v.pulse)}`);
  if (v.spo2 != null) vit.push(`SpO₂ ${v.spo2}%${tag("spo2", v.spo2)}`);
  if (v.temperatureC != null) vit.push(`temp ${v.temperatureC} °C${tag("temperatureC", v.temperatureC)}`);
  if (v.respRate != null) vit.push(`RR ${v.respRate}${tag("respRate", v.respRate)}`);
  const b = bmi(v.heightCm ?? null, v.weightKg ?? null);
  if (b) vit.push(`BMI ${b}`);
  if (vit.length) parts.push(`Vitals: ${vit.join(", ")}.`);

  if (clean(d.history)) parts.push(`History: ${clean(d.history).replace(/\.$/, "")}.`);
  if (clean(d.examination)) parts.push(`On examination: ${clean(d.examination).replace(/\.$/, "")}.`);
  if (clean(d.diagnosis)) parts.push(`Diagnosis: ${clean(d.diagnosis)}${d.icdCode ? ` [${d.icdCode}]` : ""}.`);

  const rx = d.items.filter((i) => clean(i.medicine));
  if (rx.length) {
    parts.push(
      `Prescribed ${rx
        .map((i) => [clean(i.medicine), clean(i.dosage), clean(i.frequency), clean(i.duration) && `× ${clean(i.duration)}`].filter(Boolean).join(" "))
        .join("; ")}.`
    );
  }
  if (clean(d.advice)) parts.push(`Advice: ${clean(d.advice).replace(/\.$/, "")}.`);
  if (d.followUp) parts.push(`Review on ${d.followUp}.`);
  return parts.join(" ");
}
