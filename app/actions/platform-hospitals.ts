"use server";

// Platform-admin powers over any hospital. Every action re-checks the
// platform-admin session and is written to that hospital's audit log as
// "Platform admin" so the hospital can see what support changed.
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { audit } from "@/lib/audit";
import { ROLES, ROLE_LABELS, isRole } from "@/lib/rbac";
import { rupees, toPaise } from "@/lib/money";

export type PlatformResult = { error?: string; ok?: boolean; message?: string; tempPassword?: string; savedAt?: number };

const PLATFORM = (clinicId: string) => ({ id: "platform", name: "Platform admin", clinicId });

/** 12 readable characters (no 0/O, 1/l/I), grouped for reading out on the phone. */
function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const raw = Array.from({ length: 12 }, () => abc[randomInt(abc.length)]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

function revalidateHospital(id: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/hospitals/${id}`);
}

// ─── Hospital details ──────────────────────────────────────────────────────

const hospitalSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2, "Hospital name is too short").max(120),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => /^[a-z0-9-]{2,24}$/.test(s), "Code: 2–24 lowercase letters, digits or dashes"),
  phone: z.string().trim().max(30).optional().transform((s) => s || null),
  addressText: z.string().trim().max(300).optional().transform((s) => s || null),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone — use e.g. Asia/Kolkata"),
  monthlyTarget: z.string().optional().transform((s) => toPaise(s || "0") ?? 0),
});

export async function updateHospitalDetails(_prev: PlatformResult, formData: FormData): Promise<PlatformResult> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const parsed = hospitalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const before = await prisma.clinic.findUnique({ where: { id: d.id } });
  if (!before) return { error: "Hospital not found." };
  if (d.code !== before.code && (await prisma.clinic.findUnique({ where: { code: d.code } }))) {
    return { error: `Code "${d.code}" is already used by another hospital.` };
  }
  await prisma.clinic.update({
    where: { id: d.id },
    data: { name: d.name, code: d.code, phone: d.phone, addressText: d.addressText, timezone: d.timezone, monthlyTarget: d.monthlyTarget },
  });
  const changes = [
    before.name !== d.name && `name “${before.name}” → “${d.name}”`,
    before.code !== d.code && `code ${before.code} → ${d.code}`,
    before.timezone !== d.timezone && `timezone ${before.timezone} → ${d.timezone}`,
    (before.phone ?? null) !== d.phone && "phone",
    (before.addressText ?? null) !== d.addressText && "address",
    before.monthlyTarget !== d.monthlyTarget && `target ${rupees(d.monthlyTarget)}`,
  ].filter(Boolean);
  if (changes.length) await audit(PLATFORM(d.id), "platform.hospital_update", { entity: "clinic", id: d.id }, `Platform admin updated ${changes.join(", ")}`);
  revalidateHospital(d.id);
  return { ok: true, message: "Hospital details saved", savedAt: Date.now() };
}

export async function setHospitalActive(formData: FormData) {
  await requirePlatformAdmin({ throwOnDeny: true });
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const clinic = await prisma.clinic.findUnique({ where: { id } });
  if (!clinic) return;
  await prisma.$transaction([
    prisma.clinic.update({ where: { id }, data: { active } }),
    // Suspending signs everyone out (support sessions too).
    ...(active ? [] : [prisma.session.deleteMany({ where: { user: { clinicId: id } } })]),
  ]);
  await audit(PLATFORM(id), active ? "platform.hospital_reactivate" : "platform.hospital_suspend", { entity: "clinic", id }, `Platform admin ${active ? "reactivated" : "suspended"} ${clinic.name}`);
  revalidateHospital(id);
}

// ─── Staff of any hospital ─────────────────────────────────────────────────

async function loadUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, include: { clinic: { select: { id: true, name: true } } } });
}

/** New temporary password, shown once; user must change it at next sign-in. */
export async function resetUserPassword(userId: string): Promise<PlatformResult> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const user = await loadUser(userId);
  if (!user) return { error: "User not found." };
  const pw = tempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId, impersonatedBy: null } }),
  ]);
  await audit(PLATFORM(user.clinicId), "platform.password_reset", { entity: "user", id: userId }, `Platform admin reset the password for ${user.name} (${user.email})`);
  revalidateHospital(user.clinicId);
  return { ok: true, tempPassword: pw, message: `Temporary password for ${user.email}` };
}

export async function setUserActive(userId: string, active: boolean): Promise<PlatformResult> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const user = await loadUser(userId);
  if (!user) return { error: "User not found." };
  if (!active && user.role === "admin") {
    const admins = await prisma.user.count({ where: { clinicId: user.clinicId, role: "admin", active: true } });
    if (admins <= 1) return { error: "This is the hospital's only active administrator. Add another admin first." };
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);
  await audit(PLATFORM(user.clinicId), active ? "platform.user_activate" : "platform.user_deactivate", { entity: "user", id: userId }, `Platform admin ${active ? "reactivated" : "deactivated"} ${user.name}`);
  revalidateHospital(user.clinicId);
  return { ok: true, message: `${user.name} ${active ? "reactivated" : "deactivated"}` };
}

const userEditSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES, { message: "Pick a role" }),
});

export async function updateUser(_prev: PlatformResult, formData: FormData): Promise<PlatformResult> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const parsed = userEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const user = await loadUser(d.id);
  if (!user) return { error: "User not found." };
  if (d.email !== user.email && (await prisma.user.findUnique({ where: { email: d.email } }))) return { error: "That email is already used by another account." };
  if (user.role === "admin" && d.role !== "admin") {
    const admins = await prisma.user.count({ where: { clinicId: user.clinicId, role: "admin", active: true } });
    if (admins <= 1) return { error: "Keep at least one administrator in this hospital." };
  }
  await prisma.user.update({
    where: { id: d.id },
    data: { name: d.name, email: d.email, role: d.role, doctorId: d.role === "doctor" ? user.doctorId : null },
  });
  const changes = [
    user.name !== d.name && `name → ${d.name}`,
    user.email !== d.email && `email → ${d.email}`,
    user.role !== d.role && `role ${isRole(user.role) ? ROLE_LABELS[user.role] : user.role} → ${ROLE_LABELS[d.role]}`,
  ].filter(Boolean);
  if (changes.length) await audit(PLATFORM(user.clinicId), "platform.user_update", { entity: "user", id: d.id }, `Platform admin updated ${user.name}: ${changes.join(", ")}`);
  revalidateHospital(user.clinicId);
  return { ok: true, message: "User saved", savedAt: Date.now() };
}

const addUserSchema = z.object({
  clinicId: z.string(),
  name: z.string().trim().min(2, "Enter the person's name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES, { message: "Pick a role" }),
});

export async function addHospitalUser(_prev: PlatformResult, formData: FormData): Promise<PlatformResult> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const parsed = addUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(await prisma.clinic.findUnique({ where: { id: d.clinicId } }))) return { error: "Hospital not found." };
  if (await prisma.user.findUnique({ where: { email: d.email } })) return { error: "An account with that email already exists." };
  const pw = tempPassword();
  const user = await prisma.user.create({
    data: { clinicId: d.clinicId, name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(pw), mustChangePassword: true },
  });
  await audit(PLATFORM(d.clinicId), "platform.user_create", { entity: "user", id: user.id }, `Platform admin added ${d.name} (${d.email}) as ${ROLE_LABELS[d.role]}`);
  revalidateHospital(d.clinicId);
  return { ok: true, tempPassword: pw, message: `${d.name} can sign in as ${d.email}`, savedAt: Date.now() };
}

// ─── Support mode: open a hospital as one of its users ─────────────────────

export async function openHospitalAs(formData: FormData) {
  await requirePlatformAdmin({ throwOnDeny: true });
  const userId = String(formData.get("userId"));
  const user = await loadUser(userId);
  if (!user) return;
  // Leave any normal session in this browser first.
  await destroySession();
  await createSession(user.id, { impersonatedBy: "platform" });
  await audit(PLATFORM(user.clinicId), "platform.support_open", { entity: "user", id: user.id }, `Platform admin opened ${user.clinic.name} in support mode as ${user.name} (${user.email})`);
  redirect("/dashboard");
}

/** Leave support mode and return to the platform console. */
export async function exitSupportMode() {
  const user = await getCurrentUser();
  if (user?.supportMode) {
    await audit(PLATFORM(user.clinicId), "platform.support_close", { entity: "user", id: user.id }, `Platform admin left support mode`);
  }
  await destroySession();
  redirect("/admin");
}
