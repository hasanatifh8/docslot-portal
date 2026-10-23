"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { processLabReport } from "@/lib/lab-reader";

/** Run the AI reader again (after a failure, or once the API key is set). */
export async function rereadReport(formData: FormData) {
  const user = await requirePermission("labs.upload", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const r = await prisma.labReport.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!r) return;
  await prisma.labReport.update({ where: { id }, data: { status: "processing", error: null } });
  after(() => processLabReport(id));
  revalidatePath(`/patients/${r.patientId}`);
  revalidatePath(`/patients/${r.patientId}/labs/${id}`);
}

export async function deleteReport(formData: FormData) {
  const user = await requirePermission("labs.delete", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const r = await prisma.labReport.findFirst({ where: { id, clinicId: user.clinicId }, include: { patient: { select: { name: true, uhid: true } } } });
  if (!r) return;
  await prisma.labReport.delete({ where: { id } });
  await audit(user, "lab.delete", { entity: "patient", id: r.patientId }, `Deleted report “${r.title ?? r.fileName}” for ${r.patient.name} (${r.patient.uhid})`);
  revalidatePath(`/patients/${r.patientId}`);
  redirect(`/patients/${r.patientId}/labs`);
}
