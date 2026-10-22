"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";

export type LeadState = { error?: string; ok?: boolean };

const leadSchema = z.object({
  name: z.string().trim().min(2, "Your name, please").max(80),
  hospital: z.string().trim().min(2, "Hospital or clinic name").max(120),
  phone: z
    .string()
    .transform((s) => s.replace(/[^\d+]/g, ""))
    .refine((s) => s.replace(/\D/g, "").length >= 10, "A 10-digit mobile number"),
  email: z
    .string()
    .trim()
    .optional()
    .transform((s) => s || null)
    .refine((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Check the email"),
  city: z.string().trim().max(60).optional().transform((s) => s || null),
  size: z.string().trim().max(40).optional().transform((s) => s || null),
  message: z.string().trim().max(1000).optional().transform((s) => s || null),
});

/** Public "Book a demo" form on the marketing site. */
export async function createLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  // Honeypot: real people never see or fill this field.
  if (String(formData.get("website") ?? "")) return { ok: true };
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Light de-duplication: same phone within 10 minutes = one lead.
  const recent = await prisma.lead.findFirst({ where: { phone: parsed.data.phone, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (!recent) await prisma.lead.create({ data: parsed.data });
  return { ok: true };
}

export async function setLeadStatus(formData: FormData) {
  await requirePlatformAdmin({ throwOnDeny: true });
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["new", "contacted", "won", "lost"].includes(status)) return;
  await prisma.lead.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}
