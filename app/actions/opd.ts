"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, Visit } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ensureUhid } from "@/lib/patients";
import { dayRange, parseDateOnly } from "@/lib/format";
import { OPEN_STATUSES, STATUS_LABELS, TRANSITIONS, type Transition } from "@/lib/encounter";
import { renderPrescriptionPdf } from "@/lib/prescription-pdf";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { nextInvoiceNumber, quoteConsultation, recalcInvoice } from "@/lib/billing";
import { rupees } from "@/lib/money";
import { fmt } from "@/lib/format";
import { prescriptionLink } from "@/lib/links";
import { notifyDocument, notifyMessage } from "@/lib/notify";

export type OpdFormState = { error?: string; ok?: boolean; message?: string };

function revalidateOpd(visitId?: string) {
  revalidatePath("/opd");
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  if (visitId) revalidatePath(`/opd/${visitId}`);
}

async function nextToken(clinicId: string, doctorId: string, tz: string, db: Prisma.TransactionClient = prisma) {
  const { start, end } = dayRange(tz);
  const last = await db.visit.findFirst({
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
async function auditVisit(user: SessionUser, action: string, visitId: string, text: string) {
  const v = await prisma.visit.findUnique({ where: { id: visitId }, select: { token: true, patient: { select: { name: true, uhid: true } } } });
  await audit(user, action, { entity: "visit", id: visitId }, `${v?.patient.name ?? "Patient"} (${v?.patient.uhid ?? "—"}) token #${v?.token ?? "?"}: ${text}`);
}

async function runQuiet(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof TransitionError)) throw e;
  }
}

// ─── 1. CHECKED_IN ─────────────────────────────────────────────────────────

export type CheckInQuote = {
  error?: string;
  visitType?: "new" | "follow_up";
  fee?: number;
  reason?: string;
  openVisit?: { id: string; token: number; doctor: string } | null;
};

/** Live preview for the check-in panel: fee (new vs follow-up) and duplicate-visit guard. */
export async function quoteCheckIn(patientId: string, doctorId: string): Promise<CheckInQuote> {
  const user = await requirePermission("opd.checkin", { throwOnDeny: true });
  const [doctor, open] = await Promise.all([
    prisma.doctor.findFirst({ where: { id: doctorId, clinicId: user.clinicId, active: true } }),
    prisma.visit.findFirst({
      where: { patientId, clinicId: user.clinicId, status: { in: OPEN_STATUSES } },
      include: { doctor: { select: { name: true } } },
    }),
  ]);
  if (!doctor) return { error: "Pick a doctor." };
  const q = await quoteConsultation(doctor, patientId);
  return {
    visitType: q.visitType,
    fee: q.fee,
    reason: q.reason,
    openVisit: open ? { id: open.id, token: open.token, doctor: open.doctor.name } : null,
  };
}

export type CheckInInput = {
  patientId: string;
  doctorId: string;
  complaint?: string;
  priority?: string;
  appointmentId?: string;
  /** Collect the consultation fee right away (omit = pay later). */
  payment?: { mode: string; reference?: string } | null;
};
export type CheckInResult = { error?: string; visitId?: string; token?: number; room?: string | null; doctor?: string; paid?: number; due?: number };

/**
 * One step for the front desk: queue token + consultation invoice (+ payment).
 * The fee is decided here (never trusted from the browser).
 */
export async function checkIn(input: CheckInInput): Promise<CheckInResult> {
  const user = await requirePermission("opd.checkin", { throwOnDeny: true });
  const tz = user.clinic.timezone;
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: input.patientId, clinicId: user.clinicId } }),
    prisma.doctor.findFirst({ where: { id: input.doctorId, clinicId: user.clinicId, active: true } }),
  ]);
  if (!patient) return { error: "Pick a patient." };
  if (!doctor) return { error: "Pick a doctor." };
  const priority = ["normal", "priority", "emergency"].includes(input.priority ?? "") ? input.priority! : "normal";

  const open = await prisma.visit.findFirst({ where: { patientId: patient.id, status: { in: OPEN_STATUSES } } });
  if (open) return { error: `${patient.name ?? "This patient"} is already in today's queue (token #${open.token}).`, visitId: open.id };

  let appointmentId: string | null = null;
  if (input.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, clinicId: user.clinicId, patientId: patient.id, status: "booked" },
      include: { visit: true },
    });
    if (appt && !appt.visit) appointmentId = appt.id;
  }

  await ensureUhid(patient);
  const quote = await quoteConsultation(doctor, patient.id);
  const mayCollect = can(user.role, "billing.collect");

  const visit = await prisma.$transaction(async (tx) => {
    const v = await tx.visit.create({
      data: {
        clinicId: user.clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentId,
        priority,
        visitType: quote.visitType,
        chiefComplaint: input.complaint?.trim() || null,
        checkedInById: user.id,
        token: await nextToken(user.clinicId, doctor.id, tz, tx),
      },
    });
    const inv = await tx.invoice.create({
      data: {
        clinicId: user.clinicId,
        number: await nextInvoiceNumber(user.clinicId, tx),
        patientId: patient.id,
        visitId: v.id,
        createdById: user.id,
        items: { create: [{ description: quote.label, qty: 1, unitPrice: quote.fee, amount: quote.fee }] },
      },
    });
    if (input.payment && mayCollect && quote.fee > 0) {
      await tx.payment.create({
        data: {
          invoiceId: inv.id,
          amount: quote.fee,
          mode: input.payment.mode,
          reference: input.payment.reference?.trim() || null,
          receivedById: user.id,
        },
      });
    }
    await recalcInvoice(inv.id, tx);
    // The patient is back: any follow-up they were due for is fulfilled.
    await tx.visit.updateMany({
      where: { patientId: patient.id, status: "COMPLETED", followUpDate: { not: null }, followUpClosedAt: null },
      data: { followUpClosedAt: new Date() },
    });
    return v;
  });

  const paid = input.payment && mayCollect ? quote.fee : 0;
  await audit(
    user,
    "visit.checkin",
    { entity: "visit", id: visit.id },
    `Checked in ${patient.name} (${patient.uhid}) for ${doctor.name}, token #${visit.token}, ${quote.visitType === "follow_up" ? "follow-up" : "new"}${
      priority !== "normal" ? `, ${priority}` : ""
    }${paid ? `, collected ${rupees(paid)} (${input.payment!.mode})` : ""}`
  );
  revalidateOpd();
  revalidatePath(`/patients/${patient.id}`);
  revalidatePath("/billing");
  return { visitId: visit.id, token: visit.token, room: doctor.room, doctor: doctor.name, paid, due: quote.fee - paid };
}

/** One-click check-in for a booked appointment (fee billed, collected later at the counter). */
export async function checkInAppointment(formData: FormData) {
  const user = await requirePermission("opd.checkin", { throwOnDeny: true });
  const id = String(formData.get("appointmentId"));
  const appt = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinicId, status: "booked" } });
  if (!appt) return;
  await checkIn({ patientId: appt.patientId, doctorId: appt.doctorId, appointmentId: appt.id, complaint: appt.note ?? undefined });
}

export async function cancelVisit(formData: FormData) {
  const visitId = String(formData.get("visitId"));
  await runQuiet(async () => {
    const { user } = await transition("cancel", visitId, () => ({ cancelledAt: new Date() }));
    await auditVisit(user, "visit.cancel", visitId, "visit cancelled");
    // An untouched consultation bill is voided with the visit.
    await prisma.invoice.updateMany({ where: { visitId, paid: 0, status: "unpaid" }, data: { status: "void" } });
  });
  revalidateOpd(visitId);
  revalidatePath("/billing");
}

// ─── 2. TRIAGE_IN_PROGRESS ─────────────────────────────────────────────────

export async function startTriage(formData: FormData) {
  const visitId = String(formData.get("visitId"));
  await runQuiet(async () => {
    const { user } = await transition("startTriage", visitId, (u) => ({ triageById: u.id, triageStartedAt: new Date() }));
    await auditVisit(user, "visit.triage_start", visitId, "triage started");
  });
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
    const res = await run(async () => {
      const { user } = await transition("completeTriage", visitId, () => ({ ...v, triageCompletedAt: new Date() }));
      await auditVisit(
        user,
        "visit.triage_complete",
        visitId,
        `vitals BP ${v.bpSystolic}/${v.bpDiastolic}, pulse ${v.pulse}, SpO₂ ${v.spo2}, temp ${v.temperatureC}`
      );
    });
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
  await runQuiet(async () => {
    const { user } = await transition("startConsultation", visitId, (u) => ({ consultById: u.id, consultStartedAt: new Date() }));
    await auditVisit(user, "visit.consult_start", visitId, "consultation started");
  });
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
  icdCode: text,
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
  const sendRx = formData.get("sendRx") === "on";
  if (finalize && !notes.diagnosis) return { error: "Add a diagnosis before completing the visit." };

  let patientId: string | undefined;
  let message: string | undefined;
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
    await auditVisit(
      user,
      "visit.finalize",
      visitId,
      `prescription finalized — ${notes.diagnosis}${notes.icdCode ? ` [${notes.icdCode}]` : ""}, ${items.length} medicine${items.length === 1 ? "" : "s"}`
    );
    if (sendRx) message = notifyMessage(await deliverPrescription(user, visitId), "Prescription");
  });
  revalidateOpd(visitId);
  if (patientId) revalidatePath(`/patients/${patientId}`);
  return message && res.ok ? { ...res, message } : res;
}

// ─── After completion ──────────────────────────────────────────────────────

/** WhatsApp the patient a signed link to their prescription PDF. */
async function deliverPrescription(user: SessionUser, visitId: string) {
  const v = await prisma.visit.findFirst({
    where: { id: visitId, clinicId: user.clinicId, status: "COMPLETED" },
    select: { id: true, followUpDate: true, patient: true, doctor: { select: { name: true } }, clinic: true },
  });
  if (!v) return "failed" as const;
  const follow = v.followUpDate ? `\n📅 Follow-up: ${fmt(v.followUpDate, "UTC", "EEE, d MMM yyyy")}` : "";
  const res = await notifyDocument(v.clinic, v.patient.waPhone, {
    link: prescriptionLink(v.id),
    filename: `Prescription-${v.patient.uhid ?? "patient"}.pdf`,
    caption: `${v.clinic.name}\nPrescription from ${v.doctor.name} for ${v.patient.name ?? "you"}.${follow}`,
  });
  if (res === "sent") await prisma.visit.update({ where: { id: v.id }, data: { rxSentAt: new Date() } });
  await auditVisit(user, "visit.rx_send", v.id, `prescription WhatsApp: ${res}`);
  return res;
}

export async function sendPrescription(visitId: string): Promise<{ message: string; ok: boolean }> {
  const user = await requirePermission("opd.view", { throwOnDeny: true });
  const res = await deliverPrescription(user, visitId);
  revalidatePath(`/opd/${visitId}`);
  return { ok: res === "sent", message: notifyMessage(res, "Prescription") };
}

/** Corrections after finalization: appended, never overwriting the signed record. */
export async function addAddendum(_prev: OpdFormState, formData: FormData): Promise<OpdFormState> {
  const user = await requirePermission("opd.consult", { throwOnDeny: true });
  const visitId = String(formData.get("visitId"));
  const body = String(formData.get("text") ?? "").trim();
  if (body.length < 3) return { error: "Write the correction or additional note." };
  const visit = await prisma.visit.findFirst({ where: { id: visitId, clinicId: user.clinicId } });
  if (!visit) return { error: "Visit not found." };
  if (visit.status !== "COMPLETED") return { error: "Addenda are for finalized visits — edit the consultation directly." };
  if (user.role === "doctor" && user.doctorId !== visit.doctorId) return { error: "Only the treating doctor can add an addendum." };
  await prisma.visitAddendum.create({ data: { visitId, authorId: user.id, text: body.slice(0, 4000) } });
  await auditVisit(user, "visit.addendum", visitId, `addendum: ${body.slice(0, 200)}`);
  revalidatePath(`/opd/${visitId}`);
  return { ok: true };
}

// ─── Templates ─────────────────────────────────────────────────────────────

export type TemplateInput = {
  name: string;
  shared: boolean;
  chiefComplaint?: string;
  examination?: string;
  diagnosis?: string;
  icdCode?: string;
  advice?: string;
  items: { medicine: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[];
};

export async function saveTemplate(input: TemplateInput): Promise<{ error?: string; id?: string }> {
  const user = await requirePermission("opd.consult", { throwOnDeny: true });
  const name = input.name.trim().slice(0, 60);
  if (name.length < 2) return { error: "Give the template a short name, e.g. “Viral fever”." };
  const items = input.items.filter((i) => i.medicine?.trim()).slice(0, 20);
  const t = await prisma.consultTemplate.create({
    data: {
      clinicId: user.clinicId,
      doctorId: input.shared || !user.doctorId ? null : user.doctorId,
      createdById: user.id,
      name,
      chiefComplaint: input.chiefComplaint?.trim() || null,
      examination: input.examination?.trim() || null,
      diagnosis: input.diagnosis?.trim() || null,
      icdCode: input.icdCode?.trim() || null,
      advice: input.advice?.trim() || null,
      items,
    },
  });
  await audit(user, "template.create", { entity: "template", id: t.id }, `Saved consultation template “${name}”`);
  return { id: t.id };
}

export async function deleteTemplate(id: string) {
  const user = await requirePermission("opd.consult", { throwOnDeny: true });
  const t = await prisma.consultTemplate.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!t) return;
  if (user.role !== "admin" && t.createdById !== user.id) return;
  await prisma.consultTemplate.delete({ where: { id } });
  await audit(user, "template.delete", { entity: "template", id }, `Deleted template “${t.name}”`);
}
