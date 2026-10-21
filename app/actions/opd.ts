"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma, Visit } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ensureUhid } from "@/lib/patients";
import { dayRange, parseDateOnly } from "@/lib/format";
import { OPEN_STATUSES, STATUS_LABELS, TRANSITIONS, type Transition } from "@/lib/encounter";
import { renderPrescriptionPdf } from "@/lib/prescription-pdf";

export type OpdFormState = { error?: string; ok?: boolean };

function revalidateOpd(visitId?: string) {
  revalidatePath("/opd");
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  if (visitId) revalidatePath(`/opd/${visitId}`);
}

async function nextToken(clinicId: string, doctorId: string, tz: string) {
  const { start, end } = dayRange(tz);
  const last = await prisma.visit.findFirst({
    where: { clinicId, doctorId, checkedInAt: { gte: start, lt: end } },
    orderBy: { token: "desc" },
    select: { token: true },
  });
  return (last?.token ?? 0) + 1;
}

class TransitionError extends Error {}

/**
 * The one place a visit changes status. Checks the caller's permission, that
 * the visit is in an allowed `from` state, and (for consult steps) that a
 * senior-doctor login only touches its own patients. The update is a
 * compare-and-set on the current status, so two people clicking at once can't
 * both win — the loser gets a "this visit has moved on" error.
 */
type SessionUser = Awaited<ReturnType<typeof requirePermission>>;

async function transition(
  t: Transition,
  visitId: string,
  data: (user: SessionUser, visit: Visit) => Prisma.VisitUpdateManyMutationInput = () => ({})
) {
  const rule = TRANSITIONS[t];
  const user = await requirePermission(rule.perm, { throwOnDeny: true });
  const visit = await loadForTransition(t, visitId, user);
  await commitTransition(prisma, t, visit, data(user, visit));
  return { user, visit };
}

/** Read + validate half of a transition (no writes). */
async function loadForTransition(t: Transition, visitId: string, user: SessionUser) {
  const rule = TRANSITIONS[t];
  const visit = await prisma.visit.findFirst({ where: { id: visitId, clinicId: user.clinicId } });
  if (!visit) throw new TransitionError("Visit not found.");
  assertOwnPatient(user, visit, rule.perm);
  if (!rule.from.includes(visit.status)) {
    throw new TransitionError(`This visit is already “${STATUS_LABELS[visit.status]}”. Refresh to see the latest.`);
  }
  return visit;
}

/** Write half: compare-and-set on the status we validated against. */
async function commitTransition(
  db: Prisma.TransactionClient,
  t: Transition,
  visit: Visit,
  data: Prisma.VisitUpdateManyMutationInput
) {
  const { count } = await db.visit.updateMany({
    where: { id: visit.id, status: visit.status },
    data: { ...data, status: TRANSITIONS[t].to },
  });
  if (count === 0) throw new TransitionError("Someone else just updated this visit. Refresh to see the latest.");
}

function assertOwnPatient(user: { role: string; doctorId: string | null }, visit: Visit, perm: string) {
  if (perm === "opd.consult" && user.role === "doctor" && user.doctorId !== visit.doctorId) {
    throw new TransitionError("This patient is queued for another doctor.");
  }
}

async function run(fn: () => Promise<unknown>): Promise<OpdFormState> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof TransitionError) return { error: e.message };
    throw e;
  }
}

/** Plain <form action> buttons: swallow races (the page re-renders with fresh state). */
async function runQuiet(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof TransitionError)) throw e;
  }
}

// ─── 1. CHECKED_IN ─────────────────────────────────────────────────────────

/** Walk-in check-in from the OPD page or a patient's profile. */
export async function checkInWalkIn(_prev: OpdFormState, formData: FormData): Promise<OpdFormState> {
  const user = await requirePermission("opd.checkin", { throwOnDeny: true });
  const patientId = String(formData.get("patientId") || "");
  const doctorId = String(formData.get("doctorId") || "");
  const complaint = String(formData.get("chiefComplaint") || "").trim() || null;

  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } }),
    prisma.doctor.findFirst({ where: { id: doctorId, clinicId: user.clinicId, active: true } }),
  ]);
  if (!patient) return { error: "Pick a patient." };
  if (!doctor) return { error: "Pick a doctor." };

  const open = await prisma.visit.findFirst({ where: { patientId, status: { in: OPEN_STATUSES } } });
  if (open) return { error: `${patient.name ?? "This patient"} is already in the OPD queue.` };

  await ensureUhid(patient);
  const visit = await prisma.visit.create({
    data: {
      clinicId: user.clinicId,
      patientId,
      doctorId,
      chiefComplaint: complaint,
      checkedInById: user.id,
      token: await nextToken(user.clinicId, doctorId, user.clinic.timezone),
    },
  });
  revalidateOpd();
  revalidatePath(`/patients/${patientId}`);
  redirect(`/opd/${visit.id}`);
}

/** One-click check-in for a booked appointment. */
export async function checkInAppointment(formData: FormData) {
  const user = await requirePermission("opd.checkin", { throwOnDeny: true });
  const id = String(formData.get("appointmentId"));
  const appt = await prisma.appointment.findFirst({
    where: { id, clinicId: user.clinicId, status: "booked" },
    include: { visit: true, patient: true },
  });
  if (!appt || appt.visit) return;
  if (await prisma.visit.findFirst({ where: { patientId: appt.patientId, status: { in: OPEN_STATUSES } } })) return;

  await ensureUhid(appt.patient);
  await prisma.visit.create({
    data: {
      clinicId: user.clinicId,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      appointmentId: appt.id,
      chiefComplaint: appt.note,
      checkedInById: user.id,
      token: await nextToken(user.clinicId, appt.doctorId, user.clinic.timezone),
    },
  });
  revalidateOpd();
}

export async function cancelVisit(formData: FormData) {
  const visitId = String(formData.get("visitId"));
  await runQuiet(() => transition("cancel", visitId, () => ({ cancelledAt: new Date() })));
  revalidateOpd(visitId);
}

// ─── 2. TRIAGE_IN_PROGRESS ─────────────────────────────────────────────────

export async function startTriage(formData: FormData) {
  const visitId = String(formData.get("visitId"));
  await runQuiet(() =>
    transition("startTriage", visitId, (user) => ({ triageById: user.id, triageStartedAt: new Date() }))
  );
  revalidateOpd(visitId);
}

// ─── 3. TRIAGE_COMPLETED ───────────────────────────────────────────────────

const num = (min: number, max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? Number(s) : null))
    .refine((n) => n === null || (Number.isFinite(n) && n >= min && n <= max), `${label} looks wrong`);
const int = (min: number, max: number, label: string) =>
  num(min, max, label).transform((n) => (n === null ? null : Math.round(n)));

const vitalsSchema = z
  .object({
    heightCm: num(20, 250, "Height"),
    weightKg: num(0.5, 400, "Weight"),
    temperatureC: num(30, 45, "Temperature"),
    pulse: int(20, 250, "Pulse"),
    bpSystolic: int(50, 260, "BP systolic"),
    bpDiastolic: int(30, 160, "BP diastolic"),
    spo2: int(50, 100, "SpO₂"),
    respRate: int(5, 60, "Respiratory rate"),
  })
  .refine((v) => (v.bpSystolic == null) === (v.bpDiastolic == null), "Enter both BP values, or neither");

/** Triage form. intent=save keeps triage open; intent=complete hands off to the senior doctor. */
export async function saveVitals(_prev: OpdFormState, formData: FormData): Promise<OpdFormState> {
  const visitId = String(formData.get("visitId"));
  const parsed = vitalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  if (formData.get("intent") === "complete") {
    // The doctor needs at least the basic set before the patient moves on.
    const missing = [
      v.bpSystolic == null && "BP",
      v.pulse == null && "pulse",
      v.temperatureC == null && "temperature",
      v.spo2 == null && "SpO₂",
    ].filter(Boolean);
    if (missing.length) return { error: `Record ${missing.join(", ")} before completing triage.` };
    const res = await run(() =>
      transition("completeTriage", visitId, () => ({ ...v, triageCompletedAt: new Date() }))
    );
    revalidateOpd(visitId);
    return res;
  }

  // Draft save: allowed only while triage is in progress, by someone who may triage.
  const user = await requirePermission("opd.triage", { throwOnDeny: true });
  const { count } = await prisma.visit.updateMany({
    where: { id: visitId, clinicId: user.clinicId, status: "TRIAGE_IN_PROGRESS" },
    data: v,
  });
  revalidateOpd(visitId);
  return count ? { ok: true } : { error: "Triage isn't open on this visit any more. Refresh to see the latest." };
}

// ─── 4. IN_CONSULTATION ────────────────────────────────────────────────────

export async function startConsultation(formData: FormData) {
  const visitId = String(formData.get("visitId"));
  await runQuiet(() =>
    transition("startConsultation", visitId, (user) => ({ consultById: user.id, consultStartedAt: new Date() }))
  );
  revalidateOpd(visitId);
}

// ─── 5. COMPLETED ──────────────────────────────────────────────────────────

const text = z
  .string()
  .optional()
  .transform((s) => s?.trim() || null);

const consultSchema = z.object({
  chiefComplaint: text,
  history: text,
  examination: text,
  diagnosis: text,
  advice: text,
  followUpDate: z
    .string()
    .optional()
    .transform((s) => parseDateOnly(s)),
});

function prescriptionRows(formData: FormData, visitId: string) {
  // Rows arrive as parallel arrays; blank medicine = dropped row.
  const col = (k: string) => formData.getAll(`rx.${k}`).map((v) => String(v).trim());
  const [meds, dosage, frequency, duration, instructions] = ["medicine", "dosage", "frequency", "duration", "instructions"].map(col);
  return meds
    .map((medicine, i) => ({
      visitId,
      medicine,
      dosage: dosage[i] || null,
      frequency: frequency[i] || null,
      duration: duration[i] || null,
      instructions: instructions[i] || null,
      sortOrder: i,
    }))
    .filter((r) => r.medicine);
}

/**
 * Consultation form. intent=save stores a draft (visit stays IN_CONSULTATION);
 * intent=complete finalizes: renders the PDF first (outside any transaction —
 * a render failure leaves the visit open), then writes notes, prescription,
 * PDF and the COMPLETED status in one short transaction guarded by the
 * status compare-and-set.
 */
export async function saveConsultation(_prev: OpdFormState, formData: FormData): Promise<OpdFormState> {
  const user = await requirePermission("opd.consult", { throwOnDeny: true });
  const visitId = String(formData.get("visitId"));
  const parsed = consultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const notes = parsed.data;
  const items = prescriptionRows(formData, visitId);
  const finalize = formData.get("intent") === "complete";
  if (finalize && !notes.diagnosis) return { error: "Add a diagnosis before completing the visit." };

  let patientId: string | undefined;
  const res = await run(async () => {
    // "finalize" and a draft save are both only legal from IN_CONSULTATION.
    const visit = await loadForTransition("finalize", visitId, user);
    patientId = visit.patientId;
    const replaceItems = (tx: Prisma.TransactionClient) => [
      tx.prescriptionItem.deleteMany({ where: { visitId } }),
      ...(items.length ? [tx.prescriptionItem.createMany({ data: items })] : []),
    ];

    if (!finalize) {
      await prisma.$transaction(async (tx) => {
        for (const op of replaceItems(tx)) await op;
        const { count } = await tx.visit.updateMany({ where: { id: visitId, status: "IN_CONSULTATION" }, data: notes });
        if (!count) throw new TransitionError("This visit was just closed or cancelled. Refresh to see the latest.");
      });
      return;
    }

    const full = await prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: { patient: true, doctor: true, clinic: true },
    });
    const completedAt = new Date();
    const pdf = await renderPrescriptionPdf({
      clinic: full.clinic,
      doctor: full.doctor,
      patient: full.patient,
      visit: { ...full, ...notes, completedAt },
      items,
    });
    await prisma.$transaction(async (tx) => {
      for (const op of replaceItems(tx)) await op;
      await commitTransition(tx, "finalize", visit, {
        ...notes,
        completedAt,
        prescriptionPdf: Buffer.from(pdf),
        pdfGeneratedAt: completedAt,
      });
      if (visit.appointmentId) {
        await tx.appointment.update({ where: { id: visit.appointmentId }, data: { status: "completed" } });
      }
    });
  });
  revalidateOpd(visitId);
  if (patientId) revalidatePath(`/patients/${patientId}`);
  return res;
}
