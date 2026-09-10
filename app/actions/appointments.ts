"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fromZonedTime } from "date-fns-tz";

export async function setAppointmentStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["booked", "cancelled", "completed", "no_show"].includes(status)) return;

  const appt = await prisma.appointment.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!appt) return;

  await prisma.appointment.update({ where: { id }, data: { status } });
  if (status === "cancelled") {
    await prisma.reminder.deleteMany({ where: { appointmentId: id, sentAt: null } });
  }
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export type BookState = { error?: string; ok?: boolean };

// Front-desk manual booking. Returns a form state instead of throwing so the
// UI can show a friendly message (used with useActionState).
export async function frontdeskBook(_prev: BookState, formData: FormData): Promise<BookState> {
  const user = await requireUser();
  const clinic = await prisma.clinic.findUnique({ where: { id: user.clinicId } });
  if (!clinic) return { error: "Clinic not found." };

  const doctorId = String(formData.get("doctorId"));
  const date = String(formData.get("date")); // yyyy-MM-dd
  const time = String(formData.get("time")); // HH:mm
  const patientName = String(formData.get("patientName") || "").trim();
  const waPhone = String(formData.get("waPhone") || "").replace(/\D/g, "");
  const note = String(formData.get("note") || "").trim() || null;

  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId: clinic.id } });
  if (!doctor) return { error: "Pick a doctor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and time." };
  if (waPhone.length < 10) return { error: "Enter a valid WhatsApp number with country code." };

  const startAt = fromZonedTime(`${date}T${time}:00`, clinic.timezone);
  const endAt = new Date(startAt.getTime() + doctor.slotMinutes * 60_000);

  const clash = await prisma.appointment.findFirst({
    where: { doctorId, status: "booked", startAt: { lt: endAt }, endAt: { gt: startAt } },
    include: { patient: true },
  });
  if (clash) {
    return {
      error: `${doctor.name} already has a booking that overlaps ${time} on ${date}${
        clash.patient.name ? ` (${clash.patient.name})` : ""
      }. Pick another time.`,
    };
  }

  const patient = await prisma.patient.upsert({
    where: { clinicId_waPhone: { clinicId: clinic.id, waPhone } },
    create: { clinicId: clinic.id, waPhone, name: patientName || null },
    update: { name: patientName || undefined },
  });

  const appt = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      doctorId,
      patientId: patient.id,
      startAt,
      endAt,
      source: "frontdesk",
      note,
    },
  });

  const offsets = clinic.reminderOffsets
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const reminders = offsets
    .map((offsetMinutes) => ({
      appointmentId: appt.id,
      offsetMinutes,
      sendAt: new Date(startAt.getTime() - offsetMinutes * 60_000),
    }))
    .filter((r) => r.sendAt.getTime() > Date.now());
  if (reminders.length) await prisma.reminder.createMany({ data: reminders });

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  return { ok: true };
}
