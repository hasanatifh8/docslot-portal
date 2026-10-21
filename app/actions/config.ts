"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
});

export async function addDoctor(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const d = doctorSchema.parse(Object.fromEntries(formData));
  if (d.departmentId && !(await prisma.department.findFirst({ where: { id: d.departmentId, clinicId: user.clinicId } }))) {
    d.departmentId = null;
  }
  await prisma.doctor.create({ data: { ...d, clinicId: user.clinicId } });
  revalidatePath("/doctors");
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
  revalidatePath("/doctors");
}

export async function deleteDoctor(formData: FormData) {
  const user = await requirePermission("doctors.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  await prisma.doctor.deleteMany({ where: { id, clinicId: user.clinicId } });
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
    },
  });
  revalidatePath("/settings");
}

export async function connectOwnNumber(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const phoneNumberId = String(formData.get("phoneNumberId") || "").trim();
  const token = String(formData.get("token") || "").trim();
  await prisma.clinic.update({
    where: { id: user.clinicId },
    data: {
      whatsappPhoneNumberId: phoneNumberId || null,
      whatsappToken: token || null,
    },
  });
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
