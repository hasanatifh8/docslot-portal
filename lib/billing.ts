// Server-side billing: invoice numbering, consultation-fee rules, totals.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invoiceStatus } from "@/lib/money";

type Db = PrismaClient | Prisma.TransactionClient;

export function formatInvoiceNo(n: number) {
  return `INV-${String(n).padStart(6, "0")}`;
}

/** Atomically reserve the next invoice number for a hospital. */
export async function nextInvoiceNumber(clinicId: string, db: Db = prisma) {
  const { nextInvoiceNo } = await db.clinic.update({
    where: { id: clinicId },
    data: { nextInvoiceNo: { increment: 1 } },
    select: { nextInvoiceNo: true },
  });
  return formatInvoiceNo(nextInvoiceNo - 1);
}

export type FeeQuote = { visitType: "new" | "follow_up"; fee: number; label: string; reason: string };

/**
 * New vs follow-up: a completed visit with the same doctor within the doctor's
 * follow-up window makes this a follow-up (billed at the follow-up fee).
 */
export async function quoteConsultation(
  doctor: { id: string; name: string; consultFee: number; followUpFee: number; followUpDays: number },
  patientId: string,
  db: Db = prisma
): Promise<FeeQuote> {
  const since = new Date(Date.now() - doctor.followUpDays * 24 * 3600_000);
  const last = await db.visit.findFirst({
    where: { patientId, doctorId: doctor.id, status: "COMPLETED", completedAt: { gte: since } },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  if (last && doctor.followUpDays > 0) {
    const days = Math.max(0, Math.floor((Date.now() - last.completedAt!.getTime()) / (24 * 3600_000)));
    return {
      visitType: "follow_up",
      fee: doctor.followUpFee,
      label: `Follow-up consultation — ${doctor.name}`,
      reason: `Seen ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`} (within ${doctor.followUpDays}-day follow-up window)`,
    };
  }
  return { visitType: "new", fee: doctor.consultFee, label: `Consultation — ${doctor.name}`, reason: "New consultation" };
}

/** Re-derive subtotal/total/paid/status from items and payments. */
export async function recalcInvoice(invoiceId: string, db: Db = prisma) {
  const inv = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, payments: true },
  });
  if (inv.status === "void") return inv;
  const subtotal = inv.items.reduce((s, i) => s + i.amount, 0);
  const discount = Math.min(inv.discount, subtotal);
  const total = subtotal - discount;
  const paid = inv.payments.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);
  const refunded = inv.payments.some((p) => p.kind === "refund");
  return db.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, discount, total, paid, status: invoiceStatus(total, paid, refunded) },
  });
}
