/**
 * Demo history: ~5 months of OPD visits, bills, payments, appointments and
 * expenses for the demo hospital, so dashboards, finance charts, forecasts and
 * reports look like a real, growing practice in sales demos.
 * Deterministic (seeded random), so every reseed looks the same.
 */
import type { PrismaClient } from "@prisma/client";
import { formatUhid } from "../lib/patients";
import { formatInvoiceNo } from "../lib/billing";

type Doc = { id: string; name: string; consultFee: number; followUpFee: number; slotMinutes: number };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_M = ["Rahul", "Amit", "Sanjay", "Vikram", "Rohan", "Arjun", "Karan", "Imran", "Suresh", "Anil", "Manoj", "Nikhil", "Pranav", "Rajesh", "Deepak", "Faisal", "Harish", "Yash", "Omkar", "Tushar"];
const FIRST_F = ["Priya", "Sneha", "Anjali", "Pooja", "Kavita", "Neha", "Sunita", "Meera", "Ritu", "Fatima", "Swati", "Aarti", "Komal", "Shruti", "Rekha", "Nandini", "Asha", "Divya", "Isha", "Tanvi"];
const LAST = ["Sharma", "Patil", "Kulkarni", "Deshmukh", "Joshi", "Shaikh", "Gupta", "Verma", "Pawar", "Jadhav", "Iyer", "Nair", "Reddy", "Khan", "Mehta", "Bhosale", "Chavan", "Rao", "Singh", "More"];

const DX: Record<string, [string, string, string][]> = {
  // [diagnosis, icd, medicine]
  general: [
    ["Viral infection, unspecified", "B34.9", "Paracetamol 650 mg tab"],
    ["Acute upper respiratory infection, unspecified", "J06.9", "Cetirizine 10 mg tab"],
    ["Essential (primary) hypertension", "I10", "Telmisartan 40 mg tab"],
    ["Type 2 diabetes mellitus without complications", "E11.9", "Metformin 500 mg tab"],
    ["Gastritis, unspecified", "K29.70", "Pantoprazole 40 mg tab"],
    ["Infectious gastroenteritis and colitis", "A09", "ORS sachet"],
    ["Urinary tract infection, site not specified", "N39.0", "Nitrofurantoin 100 mg cap"],
    ["Migraine, unspecified", "G43.909", "Ibuprofen 400 mg tab"],
    ["Vitamin D deficiency, unspecified", "E55.9", "Vitamin D3 60,000 IU sachet/cap"],
  ],
  ortho: [
    ["Low back pain", "M54.5", "Aceclofenac 100 mg + Paracetamol 325 mg tab"],
    ["Osteoarthritis of knee, unspecified", "M17.9", "Etoricoxib 90 mg tab"],
    ["Cervical spondylosis", "M47.812", "Thiocolchicoside 4 mg + Aceclofenac 100 mg tab"],
    ["Sprain of ankle", "S93.401", "Diclofenac gel"],
    ["Adhesive capsulitis of shoulder", "M75.00", "Calcium 500 mg + Vitamin D3 tab"],
  ],
  paeds: [
    ["Acute nasopharyngitis (common cold)", "J00", "Paracetamol 250 mg/5 ml syrup"],
    ["Acute pharyngitis, unspecified", "J02.9", "Amoxicillin 500 mg cap"],
    ["Infectious gastroenteritis and colitis", "A09", "ORS sachet"],
    ["Routine child health examination", "Z00.129", "Zinc 20 mg tab"],
    ["Encounter for immunisation", "Z23", "Paracetamol 250 mg/5 ml syrup"],
  ],
};

export async function seedHistory(
  prisma: PrismaClient,
  opts: {
    clinicId: string;
    today: Date; // hospital-local midnight (UTC instant)
    doctors: { general: Doc; ortho: Doc; paeds: Doc };
    receptionId: string;
    nurseId: string;
    doctorUserId: string;
    adminId: string;
    firstUhid: number;
    days: number;
  }
) {
  const r = rng(20261022);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const { clinicId, today, days } = opts;
  const DAY = 86400_000;
  const startDay = new Date(today.getTime() - days * DAY);

  // ── Patient pool, registered gradually ──
  const patients: { id: string; uhid: string; createdAt: Date; child: boolean }[] = [];
  const patientRows = [];
  let uhid = opts.firstUhid;
  for (let i = 0; i < 1100; i++) {
    const female = r() < 0.52;
    const child = r() < 0.22;
    const age = child ? Math.floor(between(1, 14)) : Math.floor(between(18, 78));
    const createdAt = new Date(startDay.getTime() + Math.pow(r(), 0.8) * days * DAY);
    const id = `hp_${i}`;
    const code = formatUhid(uhid++);
    patients.push({ id, uhid: code, createdAt, child });
    patientRows.push({
      id,
      clinicId,
      uhid: code,
      name: `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`,
      gender: female ? "female" : "male",
      dob: new Date(Date.UTC(new Date().getUTCFullYear() - age, Math.floor(r() * 12), 1 + Math.floor(r() * 27))),
      waPhone: `91${Math.floor(between(7000000000, 9999999999))}`,
      relation: child ? "child" : "self",
      bloodGroup: pick(["A+", "B+", "O+", "AB+", "O-", "B-", null, null]),
      createdAt,
    });
  }
  patients.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  await prisma.patient.createMany({ data: patientRows });

  // ── Day-by-day OPD ──
  const weekdayBase = [0, 58, 50, 47, 48, 45, 52]; // Sun closed
  const visits = [];
  const items: { invoiceId: string; description: string; qty: number; unitPrice: number; amount: number }[] = [];
  const invoices = [];
  const payments = [];
  const rx = [];
  const appts = [];
  let inv = 1;
  let n = 0;
  const lastSeen = new Map<string, { doctor: Doc; at: number }>();
  const docMix: [Doc, string, number][] = [
    [opts.doctors.general, "general", 0.5],
    [opts.doctors.paeds, "paeds", 0.3],
    [opts.doctors.ortho, "ortho", 0.2],
  ];

  for (let d = 0; d < days; d++) {
    const dayStart = new Date(startDay.getTime() + d * DAY);
    const wd = new Date(dayStart.getTime() + 6 * 3600_000).getUTCDay();
    if (wd === 0) continue;
    const growth = 0.72 + 0.33 * (d / days);
    const count = Math.round(weekdayBase[wd] * growth * between(0.86, 1.14));
    const tokens = new Map<string, number>();
    const eligible = patients.filter((p) => p.createdAt.getTime() < dayStart.getTime() + DAY);

    for (let k = 0; k < count; k++) {
      const roll = r();
      let acc = 0;
      let [doctor, kind] = [docMix[0][0], docMix[0][1]];
      for (const [doc, kk, w] of docMix) {
        acc += w;
        if (roll <= acc) {
          doctor = doc;
          kind = kk;
          break;
        }
      }
      const pool = eligible.filter((p) => (kind === "paeds" ? p.child : !p.child));
      const patient = pick(pool.length ? pool : eligible);
      // Arrivals peak late morning and early evening.
      const hour = r() < 0.62 ? between(9.5, 13.5) : between(16.5, 19.8);
      const checkedInAt = new Date(dayStart.getTime() + hour * 3600_000);
      const prev = lastSeen.get(patient.id);
      const followUp = !!prev && prev.doctor.id === doctor.id && checkedInAt.getTime() - prev.at < 10 * DAY;
      const cancelled = r() < 0.03;
      const triageStart = new Date(checkedInAt.getTime() + between(4, 18) * 60_000);
      const triageDone = new Date(triageStart.getTime() + between(4, 9) * 60_000);
      const consultStart = new Date(triageDone.getTime() + between(6, 42) * 60_000);
      const completedAt = new Date(consultStart.getTime() + between(5, 14) * 60_000);
      const token = (tokens.get(doctor.id) ?? 0) + 1;
      tokens.set(doctor.id, token);
      const [diagnosis, icd, med] = pick(DX[kind]);
      const id = `hv_${n++}`;
      visits.push({
        id,
        clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        token,
        status: cancelled ? ("CANCELLED" as const) : ("COMPLETED" as const),
        visitType: followUp ? "follow_up" : "new",
        priority: r() < 0.03 ? "emergency" : r() < 0.1 ? "priority" : "normal",
        checkedInAt,
        checkedInById: opts.receptionId,
        ...(cancelled
          ? { cancelledAt: triageStart }
          : {
              triageById: opts.nurseId,
              triageStartedAt: triageStart,
              triageCompletedAt: triageDone,
              consultById: opts.doctorUserId,
              consultStartedAt: consultStart,
              completedAt,
              bpSystolic: Math.round(between(108, 152)),
              bpDiastolic: Math.round(between(68, 96)),
              pulse: Math.round(between(64, 98)),
              spo2: Math.round(between(95, 99)),
              temperatureC: Math.round(between(36.4, 38.6) * 10) / 10,
              diagnosis,
              icdCode: icd,
              chiefComplaint: diagnosis.split(",")[0],
              followUpDate: r() < 0.3 ? new Date(Date.UTC(completedAt.getUTCFullYear(), completedAt.getUTCMonth(), completedAt.getUTCDate() + 7)) : null,
              followUpClosedAt: r() < 0.85 ? completedAt : null,
            }),
      });
      if (!cancelled) {
        lastSeen.set(patient.id, { doctor, at: checkedInAt.getTime() });
        rx.push({ visitId: id, medicine: med, dosage: "1 tab", frequency: pick(["1-0-1", "1-1-1", "0-0-1", "1-0-0"]), duration: pick(["3 days", "5 days", "7 days", "1 month"]), sortOrder: 0 });
      }
      if (r() < 0.42) {
        const slotStart = new Date(dayStart.getTime() + Math.round((hour - 0.25) * 4) * 15 * 60_000);
        appts.push({
          clinicId,
          doctorId: doctor.id,
          patientId: patient.id,
          startAt: slotStart,
          endAt: new Date(slotStart.getTime() + doctor.slotMinutes * 60_000),
          status: cancelled ? "cancelled" : "completed",
          source: r() < 0.62 ? "whatsapp" : "frontdesk",
          createdAt: new Date(slotStart.getTime() - between(2, 72) * 3600_000),
        });
      }

      // ── Billing ──
      const fee = followUp ? doctor.followUpFee : doctor.consultFee;
      const invId = `hi_${inv}`;
      const lines = [{ description: `${followUp ? "Follow-up consultation" : "Consultation"} — ${doctor.name}`, unitPrice: fee }];
      if (!cancelled && r() < 0.14) lines.push(pick([
        { description: "Nebulization", unitPrice: 20000 },
        { description: "ECG", unitPrice: 30000 },
        { description: "Injection (IM/IV)", unitPrice: 10000 },
        { description: "Dressing (small)", unitPrice: 15000 },
        { description: "Blood sugar (glucometer)", unitPrice: 5000 },
      ]));
      const subtotal = lines.reduce((s, l) => s + l.unitPrice, 0);
      const discount = !cancelled && subtotal && r() < 0.06 ? Math.round(subtotal * 0.1) : 0;
      const total = cancelled ? 0 : subtotal - discount;
      const recent = d > days - 25;
      const unpaid = !cancelled && recent && r() < 0.06;
      const paid = cancelled || unpaid ? 0 : total;
      invoices.push({
        id: invId,
        clinicId,
        number: formatInvoiceNo(inv++),
        patientId: patient.id,
        visitId: id,
        status: cancelled ? "void" : total === 0 ? "paid" : unpaid ? "unpaid" : "paid",
        subtotal,
        discount,
        discountReason: discount ? "Senior citizen" : null,
        total,
        paid,
        createdById: opts.receptionId,
        createdAt: checkedInAt,
      });
      lines.forEach((l) => items.push({ invoiceId: invId, description: l.description, qty: 1, unitPrice: l.unitPrice, amount: l.unitPrice }));
      if (paid > 0) {
        const m = r();
        payments.push({
          invoiceId: invId,
          amount: paid,
          mode: m < 0.56 ? "upi" : m < 0.9 ? "cash" : "card",
          reference: m < 0.56 ? `UPI${Math.floor(between(1e9, 9e9))}` : null,
          receivedById: opts.receptionId,
          createdAt: new Date(checkedInAt.getTime() + between(1, 6) * 60_000),
        });
      }
    }
  }

  const chunk = async <T,>(rows: T[], fn: (batch: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 800) await fn(rows.slice(i, i + 800));
  };
  await chunk(visits, (b) => prisma.visit.createMany({ data: b }));
  await chunk(rx, (b) => prisma.prescriptionItem.createMany({ data: b }));
  await chunk(invoices, (b) => prisma.invoice.createMany({ data: b }));
  await chunk(items, (b) => prisma.invoiceItem.createMany({ data: b }));
  await chunk(payments, (b) => prisma.payment.createMany({ data: b }));
  await chunk(appts, (b) => prisma.appointment.createMany({ data: b }));

  // No-shows on top of attended bookings (~8 %).
  const noShows = [];
  for (let i = 0; i < Math.round(appts.length * 0.08); i++) {
    const a = pick(appts);
    noShows.push({ ...a, status: "no_show", startAt: new Date(a.startAt.getTime() + 15 * 60_000), endAt: new Date(a.endAt.getTime() + 15 * 60_000) });
  }
  await chunk(noShows, (b) => prisma.appointment.createMany({ data: b }));

  // ── Upcoming bookings (next 7 days, ~35 % of slots) so capacity looks real ──
  const future = [];
  for (let d = 1; d <= 7; d++) {
    const dayStart = new Date(today.getTime() + d * DAY);
    const wd = new Date(dayStart.getTime() + 6 * 3600_000).getUTCDay();
    if (wd === 0) continue;
    for (const doctor of [opts.doctors.general, opts.doctors.paeds, opts.doctors.ortho]) {
      for (let m = 600; m + doctor.slotMinutes <= 1080; m += doctor.slotMinutes) {
        if (r() > 0.35 / d ** 0.35) continue;
        const startAt = new Date(dayStart.getTime() + m * 60_000);
        future.push({
          clinicId,
          doctorId: doctor.id,
          patientId: pick(patients).id,
          startAt,
          endAt: new Date(startAt.getTime() + doctor.slotMinutes * 60_000),
          status: "booked",
          source: r() < 0.65 ? "whatsapp" : "frontdesk",
        });
      }
    }
  }
  await chunk(future, (b) => prisma.appointment.createMany({ data: b }));

  // ── Expenses: fixed monthly costs + variable spend ──
  const expenses: Record<string, unknown>[] = [];
  const months = new Set<string>();
  for (let d = 0; d <= days; d++) months.add(new Date(startDay.getTime() + d * DAY).toISOString().slice(0, 7));
  const todayKey = today.toISOString().slice(0, 10);
  const add = (date: string, category: string, description: string, raw: number, extra: Record<string, unknown> = {}) => {
    const amount = Math.round(raw / 10000) * 10000; // whole hundreds of rupees, like real bills
    if (date <= todayKey && date >= startDay.toISOString().slice(0, 10)) expenses.push({ clinicId, date: new Date(`${date}T00:00:00Z`), category, description, amount, createdById: opts.adminId, ...extra });
  };
  for (const m of months) {
    add(`${m}-01`, "salaries", "Staff salaries", 19000000, { recurring: true, mode: "bank" });
    add(`${m}-01`, "rent", "Premises rent", 7500000, { recurring: true, mode: "bank", vendor: "Shree Properties" });
    add(`${m}-05`, "it", "DocSlot HMS subscription & internet", 850000, { recurring: true, mode: "upi" });
    add(`${m}-10`, "utilities", "Electricity bill (MSEDCL)", Math.round(between(2300000, 3100000)), { mode: "bank" });
    add(`${m}-12`, "marketing", "Local ads & health camp", Math.round(between(900000, 2200000)), { mode: "upi" });
    for (const day of ["03", "10", "17", "24"]) add(`${m}-${day}`, "consumables", "Medical consumables restock", Math.round(between(1100000, 1900000)), { mode: "bank", vendor: "MedSupply Pune" });
    if (r() < 0.6) add(`${m}-${String(Math.floor(between(6, 26))).padStart(2, "0")}`, "maintenance", pick(["AC servicing", "Plumbing repair", "Generator service"]), Math.round(between(400000, 1500000)), { mode: "cash" });
    if (r() < 0.35) add(`${m}-${String(Math.floor(between(6, 26))).padStart(2, "0")}`, "equipment", pick(["Pulse oximeters (5)", "BP monitor", "Nebulizer machine"]), Math.round(between(600000, 2500000)), { mode: "card" });
  }
  await prisma.expense.createMany({ data: expenses as never });

  return { visits: visits.length, invoices: invoices.length, nextUhid: uhid, nextInvoiceNo: inv, expenses: expenses.length };
}
