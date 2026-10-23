"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, destroySession, hashPassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { clinic: { select: { active: true } } },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  if (!user.active) return { error: "This account has been deactivated. Contact your administrator." };
  if (!user.clinic.active) return { error: "This hospital's account is suspended. Contact DocSlot support." };
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export type PasswordState = { error?: string; ok?: boolean };

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use both letters and numbers"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "The two new passwords don't match", path: ["confirm"] })
  .refine((d) => d.next !== d.current, { message: "Pick a password different from the current one", path: ["next"] });

/** Signed-in user changes their own password (also clears a forced change). */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  if (user.supportMode) return { error: "Support mode can't change a user's password — use “Reset password” in the platform console." };
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { error: "Your current password is wrong." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await audit(user, "user.password_change", { entity: "user", id: user.id }, `${user.name} changed their password`);
  return { ok: true };
}
