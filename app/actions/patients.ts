"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { nextUhid } from "@/lib/patients";
import { parseDateOnly } from "@/lib/format";

export type PatientFormState = { error?: string; ok?: boolean };

const opt = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullable()
  .optional();

const patientSchema = z.object({
  name: z.string().trim().min(2, "Enter the patient's full name"),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length >= 10, "Enter a valid phone number with country code"),
  gender: z.enum(["male", "female", "other"], { message: "Select a gender" }),
  dob: z
    .string()
    .optional()
    .transform((s) => parseDateOnly(s))
    .refine((d) => !d || d <= new Date(), "Date of birth can't be in the future"),
  bloodGroup: opt,
  email: opt,
  address: opt,
  emergencyName: opt,
  emergencyPhone: opt,
  allergies: opt,
  chronicConditions: opt,
});

function parse(formData: FormData) {
  return patientSchema.safeParse(Object.fromEntries(formData));
}

export async function registerPatient(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const user = await requirePermission("patients.edit", { throwOnDeny: true });
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { phone, ...d } = parsed.data;

  const existing = await prisma.patient.findUnique({
    where: { clinicId_waPhone: { clinicId: user.clinicId, waPhone: phone } },
  });
  if (existing) {
    return {
      error: `This phone number is already registered to ${existing.name ?? "a patient"}${
        existing.uhid ? ` (${existing.uhid})` : ""
      }. Search for them on the Patients page.`,
    };
  }

  const patient = await prisma.$transaction(async (tx) =>
    tx.patient.create({
      data: { ...d, waPhone: phone, clinicId: user.clinicId, uhid: await nextUhid(user.clinicId, tx) },
    })
  );
  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatient(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const user = await requirePermission("patients.edit", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { phone, ...d } = parsed.data;

  const patient = await prisma.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return { error: "Patient not found." };

  if (phone !== patient.waPhone) {
    const clash = await prisma.patient.findUnique({
      where: { clinicId_waPhone: { clinicId: user.clinicId, waPhone: phone } },
    });
    if (clash) return { error: `That phone number belongs to ${clash.name ?? "another patient"}.` };
  }

  await prisma.patient.update({ where: { id }, data: { ...d, waPhone: phone } });
  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  return { ok: true };
}
