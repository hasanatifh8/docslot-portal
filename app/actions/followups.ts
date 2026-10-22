"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmt } from "@/lib/format";
import { notifyMessage, notifyText } from "@/lib/notify";

export async function sendFollowUpReminder(visitId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermission("followups.view", { throwOnDeny: true });
  const v = await prisma.visit.findFirst({
    where: { id: visitId, clinicId: user.clinicId, followUpDate: { not: null } },
    include: { patient: true, doctor: true, clinic: true },
  });
  if (!v) return { ok: false, message: "Follow-up not found" };
  const text = `🔔 ${v.clinic.name}\n\nHi ${v.patient.name ?? ""}, ${v.doctor.name} asked to see you again on ${fmt(v.followUpDate!, "UTC", "EEE, d MMM")}.\n\nReply *hi* to book a slot${v.clinic.phone ? ` or call ${v.clinic.phone}` : ""}.`;
  const res = await notifyText(v.clinic, v.patient.waPhone, text);
  if (res === "sent") await prisma.visit.update({ where: { id: v.id }, data: { followUpRemindedAt: new Date() } });
  await audit(user, "followup.remind", { entity: "visit", id: v.id }, `Follow-up reminder to ${v.patient.name} (${v.patient.uhid}): ${res}`);
  revalidatePath("/follow-ups");
  return { ok: res === "sent", message: notifyMessage(res, "Reminder") };
}

export async function closeFollowUp(visitId: string, reason: string) {
  const user = await requirePermission("followups.view", { throwOnDeny: true });
  const v = await prisma.visit.findFirst({ where: { id: visitId, clinicId: user.clinicId }, include: { patient: true } });
  if (!v) return;
  await prisma.visit.update({ where: { id: v.id }, data: { followUpClosedAt: new Date() } });
  await audit(user, "followup.close", { entity: "visit", id: v.id }, `Follow-up closed for ${v.patient.name} (${v.patient.uhid}): ${reason}`);
  revalidatePath("/follow-ups");
}
