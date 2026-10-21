"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";

export type StaffFormState = { error?: string; ok?: boolean; savedAt?: number };

const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES, { message: "Pick a role" }),
  doctorId: z
    .string()
    .optional()
    .transform((s) => s || null),
});

async function checkDoctorLink(clinicId: string, role: string, doctorId: string | null, userId?: string) {
  if (role !== "doctor") return null;
  if (!doctorId) return "Link this login to a doctor profile.";
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId }, include: { user: true } });
  if (!doctor) return "Doctor not found.";
  if (doctor.user && doctor.user.id !== userId) return `${doctor.name} already has a login (${doctor.user.email}).`;
  return null;
}

export async function addStaff(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const admin = await requirePermission("staff.manage", { throwOnDeny: true });
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return { error: "An account with that email already exists." };
  }
  const linkError = await checkDoctorLink(admin.clinicId, d.role, d.doctorId);
  if (linkError) return { error: linkError };

  await prisma.user.create({
    data: {
      clinicId: admin.clinicId,
      name: d.name,
      email: d.email,
      role: d.role,
      doctorId: d.role === "doctor" ? d.doctorId : null,
      passwordHash: await hashPassword(d.password),
    },
  });
  revalidatePath("/staff");
  return { ok: true, savedAt: Date.now() };
}

export async function updateStaffRole(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const admin = await requirePermission("staff.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const parsed = staffSchema.pick({ role: true, doctorId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { role, doctorId } = parsed.data;

  const target = await prisma.user.findFirst({ where: { id, clinicId: admin.clinicId } });
  if (!target) return { error: "User not found." };
  if (target.id === admin.id && role !== "admin") return { error: "You can't remove your own admin role." };
  const linkError = await checkDoctorLink(admin.clinicId, role, doctorId, target.id);
  if (linkError) return { error: linkError };

  await prisma.user.update({
    where: { id },
    data: { role, doctorId: role === "doctor" ? doctorId : null },
  });
  revalidatePath("/staff");
  return { ok: true };
}

export async function toggleStaffActive(formData: FormData) {
  const admin = await requirePermission("staff.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const target = await prisma.user.findFirst({ where: { id, clinicId: admin.clinicId } });
  if (!target || target.id === admin.id) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { active: !target.active } }),
    // Deactivating signs them out everywhere.
    ...(target.active ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
  ]);
  revalidatePath("/staff");
}

export async function resetStaffPassword(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const admin = await requirePermission("staff.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const target = await prisma.user.findFirst({ where: { id, clinicId: admin.clinicId } });
  if (!target) return { error: "User not found." };
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  return { ok: true };
}
