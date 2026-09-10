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

// Front-desk manual booking.
export async function frontdeskBook(formData: FormData) {
  const user = await requireUser();
  const clinic = await prisma.clinic.findUnique({ where: { id: user.clinicId } });
  if (!clinic) return;

  const doctorId = String(formData.get("doctorId"));
  const date = String(formData.get("date")); // yyyy-MM-dd
  const time = String(formData.get("time")); // HH:mm
  const patientName = String(formData.get("patientName") || "").trim();
  const waPhone = String(formData.get("waPhone") || "").replace(/\D/g, "");
  const note = String(formData.get("note") || "").trim() || null;

  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId: clinic.id } });
  if (!doctor || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !waPhone) return;

  const startAt = fromZonedTime(`${date}T${time}:00`, clinic.timezone);
  const endAt = new Date(startAt.getTime() + doctor.slotMinutes * 60_000);

  const clash = await prisma.appointment.findFirst({
    where: { doctorId, status: "booked", startAt: { lt: endAt }, endAt: { gt: startAt } },
  });
  if (clash) throw new Error("That slot is already booked.");

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
}
