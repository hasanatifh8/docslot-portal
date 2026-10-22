"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { nextUhid } from "@/lib/patients";
import { parseDateOnly } from "@/lib/format";
import { audit, diffSummary } from "@/lib/audit";

export type PatientFormState = { error?: string; ok?: boolean };

const opt = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullable()
  .optional();

/** 10-digit Indian mobiles get the 91 prefix; anything else must carry its own country code. */
export async function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
}

const idRules: Record<string, { re: RegExp; msg: string }> = {
  aadhaar: { re: /^\d{12}$/, msg: "Aadhaar number must be 12 digits" },
  abha: { re: /^\d{14}$/, msg: "ABHA number must be 14 digits" },
  pan: { re: /^[A-Z]{5}\d{4}[A-Z]$/, msg: "PAN looks like ABCDE1234F" },
};

const patientSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the patient's full name"),
    phone: z
      .string()
      .transform((s) => {
        const d = s.replace(/\D/g, "").replace(/^0+/, "");
        return d.length === 10 ? `91${d}` : d;
      })
      .refine((s) => s.length >= 11 && s.length <= 15, "Enter a valid 10-digit mobile number"),
    gender: z.enum(["male", "female", "other"], { message: "Select a gender" }),
    dob: z
      .string()
      .optional()
      .transform((s) => parseDateOnly(s))
      .refine((d) => !d || d <= new Date(), "Date of birth can't be in the future")
      .refine((d) => !d || d.getUTCFullYear() >= 1900, "Check the year of birth"),
    relation: opt,
    bloodGroup: opt,
    email: z
      .string()
      .trim()
      .optional()
      .transform((s) => s || null)
      .refine((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Enter a valid email or leave it blank"),
    address: opt,
    emergencyName: opt,
    emergencyPhone: z
      .string()
      .optional()
      .transform((s) => (s ?? "").replace(/\D/g, "") || null)
      .refine((s) => !s || s.length >= 10, "Emergency phone needs 10 digits"),
    allergies: opt,
    chronicConditions: opt,
    idType: opt,
    idNumber: z
      .string()
      .optional()
      .transform((s) => (s ?? "").replace(/\s/g, "").toUpperCase() || null),
  })
  .superRefine((d, ctx) => {
    if (d.idNumber && !d.idType) ctx.addIssue({ code: "custom", message: "Pick the ID type", path: ["idType"] });
    const rule = d.idType ? idRules[d.idType] : undefined;
    if (rule && d.idNumber && !rule.re.test(d.idNumber)) ctx.addIssue({ code: "custom", message: rule.msg, path: ["idNumber"] });
  });

export type PatientInput = Record<string, string | undefined>;
export type CreatePatientResult = { error?: string; field?: string; patientId?: string; uhid?: string; name?: string };

/** Registration wizard submit. Families may share a phone number. */
export async function createPatient(input: PatientInput): Promise<CreatePatientResult> {
  const user = await requirePermission("patients.edit", { throwOnDeny: true });
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const { phone, ...d } = parsed.data;

  // Hard stop only on an exact repeat (same number + same name + same birth date).
  if (d.dob) {
    const twin = await prisma.patient.findFirst({
      where: { clinicId: user.clinicId, waPhone: phone, dob: d.dob, name: { equals: d.name, mode: "insensitive" } },
    });
    if (twin) return { error: `${twin.name} (${twin.uhid}) is already registered with these details.`, patientId: twin.id };
  }

  const patient = await prisma.$transaction(async (tx) =>
    tx.patient.create({
      data: { ...d, waPhone: phone, clinicId: user.clinicId, uhid: await nextUhid(user.clinicId, tx) },
    })
  );
  await audit(user, "patient.create", { entity: "patient", id: patient.id }, `Registered ${patient.name} (${patient.uhid}), +${phone}`);
  revalidatePath("/patients");
  return { patientId: patient.id, uhid: patient.uhid!, name: patient.name! };
}

const LABELS = {
  name: "Name",
  waPhone: "Phone",
  gender: "Gender",
  dob: "DOB",
  relation: "Relation",
  bloodGroup: "Blood group",
  email: "Email",
  address: "Address",
  emergencyName: "Emergency contact",
  emergencyPhone: "Emergency phone",
  allergies: "Allergies",
  chronicConditions: "Conditions",
  idType: "ID type",
  idNumber: "ID number",
};

export async function updatePatient(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requirePermission("patients.edit", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { phone, ...d } = parsed.data;

  const patient = await prisma.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return { error: "Patient not found." };

  const data = { ...d, waPhone: phone };
  await prisma.patient.update({ where: { id }, data });
  const changes = diffSummary(patient, data, LABELS);
  if (changes) await audit(user, "patient.update", { entity: "patient", id }, `${patient.name} (${patient.uhid}): ${changes}`);
  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  return { ok: true };
}
