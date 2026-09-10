"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from "@/lib/auth";

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

const signupSchema = z.object({
  clinicName: z.string().min(2, "Clinic name is too short"),
  name: z.string().min(2, "Your name is too short"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type FormState = { error?: string };

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clinicName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { error: "An account with that email already exists." };

  // Unique clinic code
  let code = slug(clinicName) || "clinic";
  for (let i = 0; await prisma.clinic.findUnique({ where: { code } }); i++) {
    code = `${slug(clinicName)}-${i + 2}`;
  }

  const user = await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({ data: { name: clinicName, code } });
    return tx.user.create({
      data: {
        clinicId: clinic.id,
        email: email.toLowerCase(),
        name,
        passwordHash: await hashPassword(password),
      },
    });
  });

  await createSession(user.id);
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
