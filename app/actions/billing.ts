"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextInvoiceNumber, recalcInvoice } from "@/lib/billing";
import { PAYMENT_MODES, modeLabel, rupees, toPaise } from "@/lib/money";

export type BillingResult = { error?: string; ok?: boolean; message?: string; savedAt?: number };

const MODES = PAYMENT_MODES.map((m) => m.value) as string[];

function revalidateInvoice(id: string, patientId?: string) {
  revalidatePath(`/billing/${id}`);
  revalidatePath("/billing");
  revalidatePath("/opd");
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

async function loadInvoice(clinicId: string, id: string) {
  return prisma.invoice.findFirst({ where: { id, clinicId }, include: { patient: { select: { name: true, uhid: true } } } });
}

export async function collectPayment(input: { invoiceId: string; amount: string; mode: string; reference?: string }): Promise<BillingResult> {
  const user = await requirePermission("billing.collect", { throwOnDeny: true });
  const inv = await loadInvoice(user.clinicId, input.invoiceId);
  if (!inv) return { error: "Bill not found." };
  if (inv.status === "void") return { error: "This bill is void." };
  const amount = toPaise(input.amount);
  const balance = inv.total - inv.paid;
  if (!amount || amount <= 0) return { error: "Enter the amount received." };
  if (amount > balance) return { error: `Only ${rupees(balance)} is due. Check the amount.` };
  if (!MODES.includes(input.mode)) return { error: "Pick how the patient paid." };

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { invoiceId: inv.id, amount, mode: input.mode, reference: input.reference?.trim() || null, receivedById: user.id },
    });
    await recalcInvoice(inv.id, tx);
  });
  await audit(user, "invoice.payment", { entity: "invoice", id: inv.id }, `${inv.number} (${inv.patient.name}): received ${rupees(amount)} by ${modeLabel(input.mode)}`);
  revalidateInvoice(inv.id, inv.patientId);
  return { ok: true, message: `${rupees(amount)} received` };
}

export async function addInvoiceItem(input: { invoiceId: string; serviceId?: string; description?: string; price?: string; qty?: string }): Promise<BillingResult> {
  const user = await requirePermission("billing.collect", { throwOnDeny: true });
  const inv = await loadInvoice(user.clinicId, input.invoiceId);
  if (!inv) return { error: "Bill not found." };
  if (inv.status === "void" || inv.status === "refunded") return { error: "This bill is closed." };

  let description = input.description?.trim() ?? "";
  let price = toPaise(input.price ?? "");
  if (input.serviceId) {
    const svc = await prisma.serviceItem.findFirst({ where: { id: input.serviceId, clinicId: user.clinicId, active: true } });
    if (!svc) return { error: "Service not found." };
    description = svc.name;
    price = svc.price;
  }
  const qty = Math.max(1, Math.min(99, parseInt(input.qty ?? "1", 10) || 1));
  if (description.length < 2) return { error: "Describe the charge." };
  if (price == null || price < 0) return { error: "Enter a valid price." };

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.create({ data: { invoiceId: inv.id, description, qty, unitPrice: price!, amount: price! * qty } });
    await recalcInvoice(inv.id, tx);
  });
  await audit(user, "invoice.item_add", { entity: "invoice", id: inv.id }, `${inv.number}: added ${qty} × ${description} @ ${rupees(price)}`);
  revalidateInvoice(inv.id, inv.patientId);
  return { ok: true };
}

export async function removeInvoiceItem(itemId: string): Promise<BillingResult> {
  const user = await requirePermission("billing.collect", { throwOnDeny: true });
  const item = await prisma.invoiceItem.findFirst({ where: { id: itemId, invoice: { clinicId: user.clinicId } }, include: { invoice: true } });
  if (!item) return { error: "Item not found." };
  if (item.invoice.paid > 0) return { error: "Payments were taken on this bill — use a refund instead of removing items." };
  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.delete({ where: { id: itemId } });
    await recalcInvoice(item.invoiceId, tx);
  });
  await audit(user, "invoice.item_remove", { entity: "invoice", id: item.invoiceId }, `${item.invoice.number}: removed ${item.description} (${rupees(item.amount)})`);
  revalidateInvoice(item.invoiceId, item.invoice.patientId);
  return { ok: true };
}

export async function applyDiscount(input: { invoiceId: string; amount: string; reason: string }): Promise<BillingResult> {
  const user = await requirePermission("billing.adjust", { throwOnDeny: true });
  const inv = await loadInvoice(user.clinicId, input.invoiceId);
  if (!inv) return { error: "Bill not found." };
  const amount = toPaise(input.amount);
  if (amount == null || amount < 0) return { error: "Enter the discount amount." };
  if (amount > inv.subtotal) return { error: "Discount can't be more than the bill." };
  if (inv.subtotal - amount < inv.paid) return { error: "That would make the bill less than what's already paid — refund instead." };
  if (amount > 0 && input.reason.trim().length < 3) return { error: "A reason is required for discounts (e.g. staff, senior citizen)." };

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: inv.id }, data: { discount: amount, discountReason: input.reason.trim() || null } });
    await recalcInvoice(inv.id, tx);
  });
  await audit(user, "invoice.discount", { entity: "invoice", id: inv.id }, `${inv.number}: discount ${rupees(inv.discount)} → ${rupees(amount)} (${input.reason.trim()})`);
  revalidateInvoice(inv.id, inv.patientId);
  return { ok: true };
}

export async function refundPayment(input: { invoiceId: string; amount: string; mode: string; reason: string }): Promise<BillingResult> {
  const user = await requirePermission("billing.adjust", { throwOnDeny: true });
  const inv = await loadInvoice(user.clinicId, input.invoiceId);
  if (!inv) return { error: "Bill not found." };
  const amount = toPaise(input.amount);
  if (!amount || amount <= 0) return { error: "Enter the refund amount." };
  if (amount > inv.paid) return { error: `Only ${rupees(inv.paid)} was paid on this bill.` };
  if (input.reason.trim().length < 3) return { error: "A reason is required for refunds." };
  if (!MODES.includes(input.mode)) return { error: "Pick how the refund is given." };

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { invoiceId: inv.id, kind: "refund", amount, mode: input.mode, reason: input.reason.trim(), receivedById: user.id } });
    await recalcInvoice(inv.id, tx);
  });
  await audit(user, "invoice.refund", { entity: "invoice", id: inv.id }, `${inv.number}: refunded ${rupees(amount)} by ${modeLabel(input.mode)} — ${input.reason.trim()}`);
  revalidateInvoice(inv.id, inv.patientId);
  return { ok: true, message: `${rupees(amount)} refunded` };
}

export async function voidInvoice(input: { invoiceId: string; reason: string }): Promise<BillingResult> {
  const user = await requirePermission("billing.adjust", { throwOnDeny: true });
  const inv = await loadInvoice(user.clinicId, input.invoiceId);
  if (!inv) return { error: "Bill not found." };
  if (inv.paid > 0) return { error: "Refund the payments first, then void." };
  if (input.reason.trim().length < 3) return { error: "A reason is required to void a bill." };
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "void", discountReason: `VOID: ${input.reason.trim()}` } });
  await audit(user, "invoice.void", { entity: "invoice", id: inv.id }, `${inv.number}: voided — ${input.reason.trim()}`);
  revalidateInvoice(inv.id, inv.patientId);
  return { ok: true };
}

/** Stand-alone bill for services without a visit (dressing, injection, certificate…). */
export async function createInvoice(patientId: string): Promise<{ error?: string; id?: string }> {
  const user = await requirePermission("billing.collect", { throwOnDeny: true });
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Pick a patient." };
  const inv = await prisma.$transaction(async (tx) =>
    tx.invoice.create({ data: { clinicId: user.clinicId, patientId, number: await nextInvoiceNumber(user.clinicId, tx), createdById: user.id } })
  );
  await audit(user, "invoice.create", { entity: "invoice", id: inv.id }, `${inv.number}: new bill for ${patient.name} (${patient.uhid})`);
  revalidatePath("/billing");
  return { id: inv.id };
}

// ─── Price list (Settings) ─────────────────────────────────────────────────

export async function saveService(_prev: BillingResult, formData: FormData): Promise<BillingResult> {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const name = String(formData.get("name") ?? "").trim();
  const price = toPaise(String(formData.get("price") ?? ""));
  if (name.length < 2) return { error: "Enter the service name." };
  if (price == null) return { error: "Enter a valid price, e.g. 250." };
  await prisma.serviceItem.upsert({
    where: { clinicId_name: { clinicId: user.clinicId, name } },
    create: { clinicId: user.clinicId, name, price },
    update: { price, active: true },
  });
  await audit(user, "service.save", { entity: "service" }, `Price list: ${name} = ${rupees(price)}`);
  revalidatePath("/settings");
  return { ok: true, savedAt: Date.now() };
}

export async function toggleService(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const svc = await prisma.serviceItem.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!svc) return;
  await prisma.serviceItem.update({ where: { id }, data: { active: !svc.active } });
  await audit(user, "service.toggle", { entity: "service", id }, `Price list: ${svc.name} ${svc.active ? "disabled" : "enabled"}`);
  revalidatePath("/settings");
}
