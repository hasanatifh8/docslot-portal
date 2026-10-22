"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rupees, toPaise } from "@/lib/money";
import { parseDateOnly } from "@/lib/format";
import { EXPENSE_CATEGORIES, categoryLabel, shiftMonth } from "@/lib/finance";

export type ExpenseState = { error?: string; ok?: boolean; savedAt?: number };

const CATS = EXPENSE_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const expenseSchema = z.object({
  date: z
    .string()
    .transform((s) => parseDateOnly(s))
    .refine((d) => !!d, "Pick the date")
    .refine((d) => !d || d.getTime() <= Date.now() + 366 * 86400_000, "Date is too far ahead"),
  category: z.enum(CATS, { message: "Pick a category" }),
  description: z.string().trim().min(2, "What was it for?").max(200),
  amount: z
    .string()
    .transform((s) => toPaise(s))
    .refine((n) => n != null && n > 0, "Enter the amount, e.g. 4500"),
  mode: z.enum(["cash", "upi", "card", "bank", "cheque"]).default("bank"),
  vendor: z.string().trim().max(120).optional().transform((s) => s || null),
  reference: z.string().trim().max(120).optional().transform((s) => s || null),
  recurring: z.string().optional().transform((s) => s === "on"),
});

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  revalidatePath("/reports");
}

export async function addExpense(_prev: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const user = await requirePermission("expenses.manage", { throwOnDeny: true });
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const e = await prisma.expense.create({
    data: { ...d, date: d.date!, amount: d.amount!, clinicId: user.clinicId, createdById: user.id },
  });
  await audit(user, "expense.create", { entity: "expense", id: e.id }, `Expense ${rupees(e.amount)} — ${categoryLabel(e.category)}: ${e.description}`);
  revalidateFinance();
  return { ok: true, savedAt: Date.now() };
}

export async function deleteExpense(formData: FormData) {
  const user = await requirePermission("expenses.manage", { throwOnDeny: true });
  const id = String(formData.get("id"));
  const e = await prisma.expense.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!e) return;
  await prisma.expense.delete({ where: { id } });
  await audit(user, "expense.delete", { entity: "expense", id }, `Deleted expense ${rupees(e.amount)} — ${e.description}`);
  revalidateFinance();
}

/** Copy last month's recurring expenses (rent, salaries…) into `month`, once. */
export async function copyRecurring(formData: FormData) {
  const user = await requirePermission("expenses.manage", { throwOnDeny: true });
  const month = String(formData.get("month"));
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const prev = shiftMonth(month, -1);
  const [source, existing] = await Promise.all([
    prisma.expense.findMany({
      where: { clinicId: user.clinicId, recurring: true, date: { gte: new Date(`${prev}-01T00:00:00Z`), lt: new Date(`${month}-01T00:00:00Z`) } },
    }),
    prisma.expense.findMany({
      where: { clinicId: user.clinicId, recurring: true, date: { gte: new Date(`${month}-01T00:00:00Z`), lt: new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`) } },
      select: { description: true, category: true },
    }),
  ]);
  const have = new Set(existing.map((e) => `${e.category}|${e.description}`));
  const rows = source
    .filter((e) => !have.has(`${e.category}|${e.description}`))
    .map((e) => {
      const day = Math.min(e.date.getUTCDate(), 28);
      return {
        clinicId: user.clinicId,
        createdById: user.id,
        date: new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`),
        category: e.category,
        description: e.description,
        amount: e.amount,
        mode: e.mode,
        vendor: e.vendor,
        recurring: true,
      };
    });
  if (rows.length) await prisma.expense.createMany({ data: rows });
  await audit(user, "expense.copy_recurring", { entity: "expense" }, `Copied ${rows.length} recurring expense(s) into ${month}`);
  revalidateFinance();
}

export async function setMonthlyTarget(formData: FormData) {
  const user = await requirePermission("settings.manage", { throwOnDeny: true });
  const target = toPaise(String(formData.get("monthlyTarget") ?? "")) ?? 0;
  await prisma.clinic.update({ where: { id: user.clinicId }, data: { monthlyTarget: target } });
  await audit(user, "settings.target", { entity: "clinic", id: user.clinicId }, `Monthly collection target set to ${rupees(target)}`);
  revalidatePath("/finance");
  revalidatePath("/settings");
}
