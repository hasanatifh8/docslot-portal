import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;

export function formatUhid(n: number) {
  return `UH${String(n).padStart(6, "0")}`;
}

/** Atomically reserve the next UHID for a hospital. */
export async function nextUhid(clinicId: string, db: Db = prisma) {
  const { nextUhid } = await db.clinic.update({
    where: { id: clinicId },
    data: { nextUhid: { increment: 1 } },
    select: { nextUhid: true },
  });
  return formatUhid(nextUhid - 1);
}

/**
 * Give a patient a UHID if they don't have one yet (patients created by the
 * WhatsApp bot / front desk upserts, or rows from before HMS).
 */
export async function ensureUhid<T extends { id: string; clinicId: string; uhid: string | null }>(
  patient: T
): Promise<T & { uhid: string }> {
  if (patient.uhid) return patient as T & { uhid: string };
  const uhid = await nextUhid(patient.clinicId);
  await prisma.patient.update({ where: { id: patient.id }, data: { uhid } });
  return { ...patient, uhid };
}

export function ageFrom(dob: Date | null | undefined, now = new Date()) {
  if (!dob) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** "34 y · Male" style summary. */
export function patientMeta(p: { dob: Date | null; gender: string | null }) {
  const age = ageFrom(p.dob);
  return [age != null ? `${age} y` : null, p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : null]
    .filter(Boolean)
    .join(" · ");
}

/** Shape the booking / check-in pickers expect for a preselected patient. */
export function toPicked(
  p: { id: string; name: string | null; uhid: string | null; waPhone: string; gender: string | null; dob: Date | null; relation: string | null; allergies: string | null },
  lastDoctorId: string | null = null
) {
  return {
    id: p.id,
    name: p.name,
    uhid: p.uhid,
    waPhone: p.waPhone,
    gender: p.gender,
    age: ageFrom(p.dob),
    relation: p.relation,
    allergies: p.allergies,
    lastDoctorId,
  };
}
