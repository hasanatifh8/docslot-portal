import Link from "next/link";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { Trash2, Wallet } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { modeLabel, rupees } from "@/lib/money";
import { categoryLabel, monthLabel, shiftMonth } from "@/lib/finance";
import { copyRecurring, deleteExpense } from "@/app/actions/finance";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";
import { BarList } from "@/components/mini-charts";
import { SERIES } from "@/lib/chart-palette";

export default async function ExpensesPage({ searchParams }: PageProps<"/finance/expenses">) {
  const user = await requirePermission("finance.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const today = dayRange(tz).day;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const canManage = can(user.role, "expenses.manage");

  const [rows, prevRecurring] = await Promise.all([
    prisma.expense.findMany({
      where: { clinicId: user.clinicId, date: { gte: new Date(`${month}-01T00:00:00Z`), lt: new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.expense.count({
      where: { clinicId: user.clinicId, recurring: true, date: { gte: new Date(`${shiftMonth(month, -1)}-01T00:00:00Z`), lt: new Date(`${month}-01T00:00:00Z`) } },
    }),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
  const hasRecurringThisMonth = rows.some((r) => r.recurring);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Wallet}
        title="Expenses"
        description={`${monthLabel(month, "long")} · ${rupees(total)} across ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/finance/expenses?month=${shiftMonth(month, -1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href="/finance/expenses" className={buttonClass(month === today.slice(0, 7) ? "primary" : "secondary", "sm")}>
              This month
            </Link>
            <Link href={`/finance/expenses?month=${shiftMonth(month, 1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      {canManage && prevRecurring > 0 && !hasRecurringThisMonth && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/80 px-5 py-4">
          <p className="text-sm text-amber-900">
            <strong>{prevRecurring}</strong> recurring expense{prevRecurring > 1 ? "s" : ""} (rent, salaries…) from {monthLabel(shiftMonth(month, -1), "long")} not added yet.
          </p>
          <form action={copyRecurring}>
            <input type="hidden" name="month" value={month} />
            <Button size="sm">
              <Repeat className="h-3.5 w-3.5" /> Add them to {monthLabel(month)}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle icon={Wallet}>Record an expense</CardTitle>
              </CardHeader>
              <CardBody>
                <ExpenseForm today={today} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle icon={Wallet}>Entries</CardTitle>
            </CardHeader>
            {rows.length === 0 ? (
              <EmptyState icon={Wallet} title="No expenses this month" description="Record rent, salaries, consumables and bills to see true profit on the Finance page." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                    <div className="tabular w-16 shrink-0 text-xs text-slate-500">{fmt(r.date, "UTC", "d MMM")}</div>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {r.description}
                        {r.recurring && (
                          <Badge tone="brand" className="ml-2 normal-case">
                            monthly
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {categoryLabel(r.category)} · {r.mode === "bank" ? "Bank transfer" : r.mode === "cheque" ? "Cheque" : modeLabel(r.mode)}
                        {r.vendor && ` · ${r.vendor}`}
                        {r.reference && ` · ${r.reference}`}
                        {r.createdBy && ` · ${r.createdBy.name}`}
                      </div>
                    </div>
                    <span className="tabular text-sm font-semibold text-slate-900">{rupees(r.amount)}</span>
                    {canManage && (
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${r.description}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle icon={Wallet}>By category</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="tabular mb-4 text-2xl font-bold text-slate-900">{rupees(total)}</div>
            <BarList
              items={[...byCat.entries()].map(([name, value]) => ({ name: categoryLabel(name), value })).sort((a, b) => b.value - a.value)}
              color={SERIES.orange}
              empty="Nothing recorded yet"
            />
          </CardBody>
        </Card>
      </div>
      <p className="text-center text-[11px] text-slate-400">Dates are when the money was spent. Entries are recorded in the audit log.</p>
    </div>
  );
}
