"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toPaise, rupees } from "@/lib/money";
import { fmt, parseDateOnly } from "@/lib/format";
import { notifyText } from "@/lib/notify";

// ─── Doctors ───────────────────────────────────────────────────────────────

const optText = z
  .string()
  .optional()
  .transform((s) => s?.trim() || null);

const doctorSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().min(2),
  departmentId: optText,
  qualification: optText,
  registrationNo: optText,
  slotMinutes: z.coerce.number().int().min(5).max(240),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  room: optText,
  consultFee: z.string().optional().transform((s) => toPaise(s || "0") ?? 0),
  followUpFee: z.string().optional().transform((s) => toPaise(s || "0") ?? 0),
  followUpDays: z.coerce.number().int().min(0).max(60).default(7),
});

export async function addDoctor(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const d = doctorSchema.parse(Object.fromEntries(formData));
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, clinicId: user.clinicId } }))) {
    d.departmentId = null;
  }
  const doc = await prisma.doctor.create({ data: { ...d, clinicId: user.clinicId } });
  await audit(user, "doctor.create", { entity: "doctor", id: doc.id }, `Added ${d.name} (${d.specialty}), fee ${rupees(d.consultFee)}`);
  revalidatePath("/doctors");
}

/** Room, fees and follow-up window — what the front desk and billing use. */
export async function updateDoctorPractice(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const doctor = await prisma.doctor.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!doctor) return;
  const consultFee = toPaise(String(formData.get("consultFee") ?? "")) ?? doctor.consultFee;
  const followUpFee = toPaise(String(formData.get("followUpFee") ?? "")) ?? doctor.followUpFee;
  const followUpDays = Math.max(0, Math.min(60, parseInt(String(formData.get("followUpDays") ?? ""), 10) || 0));
  const room = String(formData.get("room") ?? "").trim() || null;
  await prisma.doctor.update({ where: { id }, data: { consultFee, followUpFee, followUpDays, room } });
  await audit(
    user,
    "doctor.update",
    { entity: "doctor", id },
    `${doctor.name}: fee ${rupees(doctor.consultFee)} → ${rupees(consultFee)}, follow-up ${rupees(followUpFee)} within ${followUpDays} days, room ${room ?? "—"}`
  );
  revalidatePath("/doctors");
}

// ─── Doctor leave ──────────────────────────────────────────────────────────

export async function addLeave(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const doctorId = String(formData.get("doctorId"));
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId: user.clinicId } });
  const start = parseDateOnly(String(formData.get("startDate") ?? ""));
  const end = parseDateOnly(String(formData.get("endDate") ?? "")) ?? start;
  if (!doctor || !start || !end || end < start) return;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await prisma.doctorLeave.create({ data: { doctorId, startDate: start, endDate: end, reason } });
  await audit(user, "doctor.leave_add", { entity: "doctor", id: doctorId }, `${doctor.name} on leave ${fmt(start, "UTC", "d MMM")}–${fmt(end, "UTC", "d MMM yyyy")}${reason ? ` (${reason})` : ""}`);
  revalidatePath("/doctors");
}

export async function deleteLeave(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const leave = await prisma.doctorLeave.findFirst({ where: { id, doctor: { clinicId: user.clinicId } }, include: { doctor: true } });
  if (!leave) return;
  await prisma.doctorLeave.delete({ where: { id } });
  await audit(user, "doctor.leave_remove", { entity: "doctor", id: leave.doctorId }, `${leave.doctor.name}: leave ${fmt(leave.startDate, "UTC", "d MMM")} removed`);
  revalidatePath("/doctors");
}

/** Cancel every booking that falls inside a leave and tell each patient on WhatsApp. */
export async function cancelLeaveBookings(formData: FormData) {
  const user = await requirePermission("appointments.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const leave = await prisma.doctorLeave.findFirst({ where: { id, doctor: { clinicId: user.clinicId } }, include: { doctor: true } });
  if (!leave) return;
  const tz = user.clinic.timezone;
  const appts = await prisma.appointment.findMany({
    where: {
      doctorId: leave.doctorId,
      status: "booked",
      startAt: { gte: new Date(leave.startDate.getTime() - 14 * 3600_000), lt: new Date(leave.endDate.getTime() + 38 * 3600_000) },
    },
    include: { patient: true },
  });
  const inLeave = appts.filter((a) => {
    const d = fmt(a.startAt, tz, "yyyy-MM-dd");
    return d >= leave.startDate.toISOString().slice(0, 10) && d <= leave.endDate.toISOString().slice(0, 10);
  });
  for (const a of inLeave) {
    await prisma.appointment.update({ where: { id: a.id }, data: { status: "cancelled" } });
    await prisma.reminder.deleteMany({ where: { appointmentId: a.id, sentAt: null } });
    await notifyText(
      user.clinic,
      a.patient.waPhone,
      `🙏 ${user.clinic.name}\n\n${leave.doctor.name} is unavailable on ${fmt(a.startAt, tz, "EEE, d MMM")}, so ${a.patient.name ? `${a.patient.name}'s` : "your"} appointment at ${fmt(a.startAt, tz, "h:mm a")} has been cancelled. Sorry for the inconvenience.\n\nReply *hi* to book a new time.`
    );
  }
  await audit(user, "doctor.leave_cancel_bookings", { entity: "doctor", id: leave.doctorId }, `${leave.doctor.name}: cancelled ${inLeave.length} booking(s) during leave and notified patients`);
  revalidatePath("/doctors");
  revalidatePath("/appointments");
}

export async function setDoctorDepartment(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const departmentId = String(formData.get("departmentId") || "") || null;
  if (departmentId && !(await prisma.department.findFirst({ where: { id: departmentId, clinicId: user.clinicId } }))) {
    return;
  }
  await prisma.doctor.updateMany({ where: { id, clinicId: user.clinicId }, data: { departmentId } });
  revalidatePath("/doctors");
}

// ─── Departments ───────────────────────────────────────────────────────────

export async function addDepartment(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) return;
  await prisma.department.upsert({
    where: { clinicId_name: { clinicId: user.clinicId, name } },
    create: { clinicId: user.clinicId, name },
    update: {},
  });
  revalidatePath("/doctors");
}

export async function deleteDepartment(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  await prisma.department.deleteMany({ where: { id: String(formData.get("id")), clinicId: user.clinicId } });
  revalidatePath("/doctors");
}

export async function toggleDoctor(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const doctor = await prisma.doctor.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!doctor) return;
  await prisma.doctor.update({ where: { id }, data: { active: !doctor.active } });
  await audit(user, doctor.active ? "doctor.deactivate" : "doctor.activate", { entity: "doctor", id }, `${doctor.active ? "Deactivated" : "Activated"} ${doctor.name}`);
  revalidatePath("/doctors");
}

export async function deleteDoctor(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  // Deleting cascades to visits and prescriptions — only allowed for a doctor with no history.
  const used = await prisma.doctor.findFirst({
    where: { id, clinicId: user.clinicId, OR: [{ visits: { some: {} } }, { appointments: { some: {} } }] },
  });
  if (used) return;
  const gone = await prisma.doctor.findFirst({ where: { id, clinicId: user.clinicId } });
  await prisma.doctor.deleteMany({ where: { id, clinicId: user.clinicId } });
  if (gone) await audit(user, "doctor.delete", { entity: "doctor", id }, `Deleted ${gone.name}`);
  revalidatePath("/doctors");
}

// ─── Working hours ─────────────────────────────────────────────────────────
// Simple model: one window per weekday. "HH:mm" inputs from the form.

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export async function setWorkingHours(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const doctorId = String(formData.get("doctorId"));
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId: user.clinicId } });
  if (!doctor) return;

  const rows: { doctorId: string; weekday: number; startMin: number; endMin: number }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (formData.get(`on-${wd}`) !== "on") continue;
    const start = String(formData.get(`start-${wd}`) || "");
    const end = String(formData.get(`end-${wd}`) || "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    const startMin = toMin(start);
    const endMin = toMin(end);
    if (endMin <= startMin) continue;
    rows.push({ doctorId, weekday: wd, startMin, endMin });
  }

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { doctorId } }),
    ...(rows.length ? [prisma.workingHour.createMany({ data: rows })] : []),
  ]);
  revalidatePath("/doctors");
}

// ─── Clinic settings ───────────────────────────────────────────────────────

const clinicSchema = z.object({
  name: z.string().min(2),
  timezone: z.string().min(1),
  addressText: z.string().optional(),
  mapsUrl: z.string().optional(),
  prepInstructions: z.string().optional(),
  reminderOffsets: z.string().regex(/^(\d+)(,\s*\d+)*$/, "Comma-separated minutes, e.g. 1440,120"),
  phone: z.string().optional(),
});

export async function updateClinic(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const raw = Object.fromEntries(formData);
  const d = clinicSchema.parse(raw);
  await prisma.clinic.update({
    where: { id: user.clinicId },
    data: {
      name: d.name,
      timezone: d.timezone,
      addressText: d.addressText || null,
      mapsUrl: d.mapsUrl || null,
      prepInstructions: d.prepInstructions || null,
      reminderOffsets: d.reminderOffsets.replace(/\s/g, ""),
      phone: d.phone?.trim() || null,
    },
  });
  await audit(user, "settings.update", { entity: "clinic", id: user.clinicId }, "Updated hospital details");
  revalidatePath("/settings");
}

export async function connectOwnNumber(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const phoneNumberId = String(formData.get("phoneNumberId") || "").trim();
  const token = String(formData.get("token") || "").trim();
  // Blank token = keep the saved one; clearing the phone number ID disconnects.
  await prisma.clinic.update({
    where: { id: user.clinicId },
    data: {
      whatsappPhoneNumberId: phoneNumberId || null,
      ...(token || !phoneNumberId ? { whatsappToken: phoneNumberId ? token : null } : {}),
    },
  });
  await audit(user, "settings.whatsapp", { entity: "clinic", id: user.clinicId }, phoneNumberId ? "Updated own WhatsApp number" : "Disconnected own WhatsApp number");
  revalidatePath("/settings");
}

// ─── Holidays ──────────────────────────────────────────────────────────────

export async function addHoliday(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await prisma.holiday.create({
    data: {
      clinicId: user.clinicId,
      date: new Date(`${date}T00:00:00Z`),
      reason: String(formData.get("reason") || "") || null,
    },
  });
  revalidatePath("/settings");
}

export async function deleteHoliday(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  await prisma.holiday.deleteMany({
    where: { id: String(formData.get("id")), clinicId: user.clinicId },
  });
  revalidatePath("/settings");
}
