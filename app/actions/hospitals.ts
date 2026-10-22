"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-auth";

export type HospitalFormState = { error?: string; ok?: string; savedAt?: number };

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

const hospitalSchema = z.object({
  hospitalName: z.string().trim().min(2, "Hospital name is too short"),
  // Optional — derived from the name when left blank.
  code: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((s) => s || "")
    .refine((s) => !s || /^[a-z0-9-]{2,24}$/.test(s), "Code: 2–24 lowercase letters, digits or dashes"),
  adminName: z.string().trim().min(2, "Enter the administrator's name"),
  adminEmail: z.string().trim().toLowerCase().email("Enter a valid administrator email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Platform admin only: creates a hospital together with its first administrator login. */
export async function createHospital(_prev: HospitalFormState, formData: FormData): Promise<HospitalFormState> {
  await requirePlatformAdmin({ throwOnDeny: true });
  const parsed = hospitalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (await prisma.user.findUnique({ where: { email: d.adminEmail } })) {
    return { error: "An account with that email already exists." };
  }

  let code = d.code;
  if (code) {
    if (await prisma.clinic.findUnique({ where: { code } })) return { error: `Code "${code}" is already taken.` };
  } else {
    const base = slug(d.hospitalName) || "hospital";
    code = base;
    for (let i = 2; await prisma.clinic.findUnique({ where: { code } }); i++) code = `${base}-${i}`;
  }

  await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({ data: { name: d.hospitalName, code } });
    await tx.user.create({
      data: {
        clinicId: clinic.id,
        email: d.adminEmail,
        name: d.adminName,
        role: "admin",
        passwordHash: await hashPassword(d.password),
      },
    });
  });

  revalidatePath("/admin");
  return { ok: `${d.hospitalName} created (code "${code}"). ${d.adminEmail} can now sign in.`, savedAt: Date.now() };
}
