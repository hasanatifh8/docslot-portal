"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ensureUhid } from "@/lib/patients";
import { doctorSlots } from "@/lib/availability";
import { audit } from "@/lib/audit";
import { fmt } from "@/lib/format";
import { localDateString } from "@/lib/slots";
import { notifyMessage, notifyText } from "@/lib/notify";

function revalidateAppointments() {
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/opd");
  revalidatePath("/follow-ups");
}

const STATUS_TEXT: Record<string, string> = { booked: "booked", cancelled: "cancelled", completed: "completed", no_show: "no-show" };

export async function setAppointmentStatus(formData: FormData) {
  const user = await requirePermission("appointments.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["booked", "cancelled", "completed", "no_show"].includes(status)) return;

  const appt = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinicId }, include: { patient: true, doctor: true } });
  if (!appt) return;

  await prisma.appointment.update({ where: { id }, data: { status } });
  if (status === "cancelled") {
    await prisma.reminder.deleteMany({ where: { appointmentId: id, sentAt: null } });
  }
  await audit(
    user,
    `appointment.${status}`,
    { entity: "appointment", id },
    `${appt.patient.name ?? appt.patient.waPhone} with ${appt.doctor.name} on ${fmt(appt.startAt, user.clinic.timezone, "d MMM, h:mm a")} marked ${STATUS_TEXT[status]}`
  );
  revalidateAppointments();
}

async function scheduleReminders(appointmentId: string, startAt: Date, reminderOffsets: string) {
  const offsets = reminderOffsets
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const rows = offsets
    .map((offsetMinutes) => ({ appointmentId, offsetMinutes, sendAt: new Date(startAt.getTime() - offsetMinutes * 60_000) }))
    .filter((r) => r.sendAt.getTime() > Date.now());
  if (rows.length) await prisma.reminder.createMany({ data: rows });
}

export type BookInput = {
  patientId: string;
  doctorId: string;
  start: string; // ISO instant of the chosen slot
  note?: string;
  notify?: boolean;
  rescheduleOf?: string;
};
export type BookResult = { error?: string; appointmentId?: string; message?: string };

/** Booking wizard submit (also reschedules: the old appointment is cancelled in the same step). */
export async function bookAppointment(input: BookInput): Promise<BookResult> {
  const user = await requirePermission("appointments.manage", { throwOnDeny: true });
  const clinic = user.clinic;
  const tz = clinic.timezone;

  const [patient, doctor, old] = await Promise.all([
    prisma.patient.findFirst({ where: { id: input.patientId, clinicId: clinic.id } }),
    prisma.doctor.findFirst({ where: { id: input.doctorId, clinicId: clinic.id, active: true }, include: { workingHours: true } }),
    input.rescheduleOf
      ? prisma.appointment.findFirst({ where: { id: input.rescheduleOf, clinicId: clinic.id, status: "booked" } })
      : Promise.resolve(null),
  ]);
  if (!patient) return { error: "Pick a patient." };
  if (!doctor) return { error: "That doctor is no longer available. Pick another." };
  if (input.rescheduleOf && !old) return { error: "The original appointment was already changed. Refresh and try again." };

  const startAt = new Date(input.start);
  if (Number.isNaN(startAt.getTime())) return { error: "Pick a time slot." };
  if (startAt.getTime() < Date.now() - 5 * 60_000) return { error: "That time has already passed. Pick a later slot." };

  // Re-check against the live schedule: someone may have taken the slot meanwhile.
  const date = localDateString(startAt, tz);
  const { free } = await doctorSlots(doctor, date, tz, { excludeAppointmentId: old?.id });
  const slot = free.find((s) => s.startAt.getTime() === startAt.getTime());
  if (!slot) return { error: `${fmt(startAt, tz, "h:mm a")} was just taken or is unavailable. Pick another slot.` };

  await ensureUhid(patient);
  const appt = await prisma.$transaction(async (tx) => {
    if (old) {
      await tx.appointment.update({ where: { id: old.id }, data: { status: "cancelled" } });
      await tx.reminder.deleteMany({ where: { appointmentId: old.id, sentAt: null } });
    }
    // Booking the return visit fulfils any open follow-up.
    await tx.visit.updateMany({
      where: { patientId: patient.id, status: "COMPLETED", followUpDate: { not: null }, followUpClosedAt: null },
      data: { followUpClosedAt: new Date() },
    });
    return tx.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        source: "frontdesk",
        note: input.note?.trim() || null,
      },
    });
  });
  await scheduleReminders(appt.id, slot.startAt, clinic.reminderOffsets);

  const when = fmt(slot.startAt, tz, "EEE, d MMM · h:mm a");
  await audit(
    user,
    old ? "appointment.reschedule" : "appointment.book",
    { entity: "appointment", id: appt.id },
    old
      ? `Rescheduled ${patient.name} with ${doctor.name}: ${fmt(old.startAt, tz, "d MMM h:mm a")} → ${when}`
      : `Booked ${patient.name} with ${doctor.name} on ${when}`
  );

  let message: string | undefined;
  if (input.notify) {
    let text = `${old ? "🔁 Rescheduled" : "✅ Appointment booked"}\n\n👤 ${patient.name}\n🩺 ${doctor.name} (${doctor.specialty})\n📅 ${when}\n🏥 ${clinic.name}`;
    if (clinic.addressText) text += `\n📍 ${clinic.addressText}`;
    if (clinic.prepInstructions) text += `\n\nℹ️ ${clinic.prepInstructions}`;
    message = notifyMessage(await notifyText(clinic, patient.waPhone, text), "Confirmation");
  }
  revalidateAppointments();
  revalidatePath(`/patients/${patient.id}`);
  return { appointmentId: appt.id, message };
}
