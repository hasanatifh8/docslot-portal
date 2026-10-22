import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart3,
  Banknote,
  CalendarCheck2,
  CalendarRange,
  Download,
  FileText,
  IndianRupee,
  ReceiptText,
  Sparkles,
  Stethoscope,
  Wallet,
} from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { rupees } from "@/lib/money";
import { inrShort } from "@/lib/chart-palette";
import { breakdowns, capacity, categoryLabel, dailySeries, hospitalClosedDays, monthBounds, monthLabel, shiftMonth, toMonths } from "@/lib/finance";
import { forecast, nextDates, pctChange } from "@/lib/forecast";
import { Banner, Card, CardBody, CardHeader, CardTitle, IconChip, PageHeader, buttonClass, cn } from "@/components/ui";
import { MoneyTrendChart, RevenueExpenseChart } from "@/components/charts";
import { BarList, Delta, ModeMix, TargetRing } from "@/components/mini-charts";
import { SERIES } from "@/lib/chart-palette";

/**
 * Owner's money view: this month vs last, profit, target, forecast to
 * month-end, where revenue comes from and where it goes.
 */
export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const user = await requirePermission("finance.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const today = dayRange(tz).day;
  const thisMonth = today.slice(0, 7);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const isCurrent = month === thisMonth;
  const mb = monthBounds(month, tz);
  const monthEndDay = `${month}-${String(mb.days).padStart(2, "0")}`;
  const lastDay = isCurrent ? today : monthEndDay;
  const dayOfMonth = Number(lastDay.slice(8));

  // One query window covers: 12 months of P&L, 12 weeks of forecast history.
  const from = (() => {
    const a = `${shiftMonth(month, -11)}-01`;
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 84);
    const b = d.toISOString().slice(0, 10);
    return a < b ? a : b;
  })();
  const [series, bd, outstanding, closed, cap, clinic] = await Promise.all([
    dailySeries(user.clinicId, tz, from, lastDay),
    breakdowns(user.clinicId, mb.start, mb.end, mb.startDay, monthEndDay),
    prisma.invoice.findMany({ where: { clinicId: user.clinicId, status: { in: ["unpaid", "partial"] } }, select: { total: true, paid: true } }),
    hospitalClosedDays(user.clinicId, tz),
    isCurrent ? capacity(user.clinicId, tz, 7) : Promise.resolve(null),
    prisma.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { monthlyTarget: true } }),
  ]);

  const monthDays = series.filter((d) => d.date.startsWith(month));
  const prevMonth = shiftMonth(month, -1);
  // Like-for-like: same number of days into last month.
  const prevDays = series.filter((d) => d.date.startsWith(prevMonth) && Number(d.date.slice(8)) <= dayOfMonth);
  const sum = (rows: typeof series, k: "collected" | "billed" | "expenses" | "visits") => rows.reduce((s, r) => s + r[k], 0);
  const collected = sum(monthDays, "collected");
  const billed = sum(monthDays, "billed");
  const expenses = sum(monthDays, "expenses");
  const visits = sum(monthDays, "visits");
  const profit = collected - expenses;
  const margin = collected ? Math.round((profit / collected) * 100) : 0;
  const due = outstanding.reduce((s, i) => s + i.total - i.paid, 0);
  const perVisit = visits ? Math.round(collected / visits / 100) * 100 : 0;
  const collectionRate = billed ? Math.round((collected / billed) * 100) : 0;

  // Forecast the rest of this month + 2 weeks, from history up to yesterday.
  const history = series.filter((d) => d.date < today).map((d) => ({ date: d.date, value: d.collected }));
  const horizon = isCurrent ? nextDates(today, Math.max(14, mb.days - dayOfMonth)) : [];
  const fc = isCurrent ? forecast(history, [today, ...horizon], { closed }) : [];
  const todayFc = fc[0];
  const rest = fc.slice(1).filter((p) => p.date <= monthEndDay);
  const projected = roundRupee(collected + Math.max(0, (todayFc?.value ?? 0) - (monthDays.at(-1)?.collected ?? 0)) + rest.reduce((s, p) => s + p.value, 0));
  const projectedLow = collected + rest.reduce((s, p) => s + p.low, 0);
  const projectedHigh = collected + rest.reduce((s, p) => s + p.high, 0);

  const trend = [
    ...monthDays.map((d) => ({ date: d.date, actual: d.collected })),
    ...fc.slice(1, 15).map((p) => (p.closed ? { date: p.date } : { date: p.date, forecast: p.value, low: p.low, high: p.high })),
  ];
  const months = toMonths(series.filter((d) => d.date >= `${shiftMonth(month, -11)}-01`)).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const target = clinic.monthlyTarget;

  const kpis = [
    { label: "Collected", value: rupees(collected), icon: Banknote, tone: "emerald" as const, delta: <Delta pct={pctChange(collected, sum(prevDays, "collected"))} /> },
    { label: "Expenses", value: rupees(expenses), icon: Wallet, tone: "amber" as const, delta: <Delta pct={pctChange(expenses, sum(prevDays, "expenses"))} goodWhenUp={false} /> },
    {
      label: "Net profit",
      value: rupees(profit),
      icon: IndianRupee,
      tone: profit >= 0 ? ("brand" as const) : ("rose" as const),
      delta: <span className="text-[11px] text-slate-500">{margin}% margin</span>,
    },
    { label: "Patients seen", value: String(visits), icon: Stethoscope, tone: "sky" as const, delta: <Delta pct={pctChange(visits, sum(prevDays, "visits"))} /> },
    { label: "Revenue per visit", value: rupees(perVisit), icon: ReceiptText, tone: "violet" as const, delta: <span className="text-[11px] text-slate-500">collected ÷ patients</span> },
    {
      label: "Outstanding dues",
      value: rupees(due),
      icon: CalendarCheck2,
      tone: due ? ("rose" as const) : ("slate" as const),
      delta: <span className="text-[11px] text-slate-500">{collectionRate}% of this month&apos;s bills collected</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={IndianRupee}
        title="Finance"
        description={`${monthLabel(month, "long")}${isCurrent ? ` · up to ${new Date(`${today}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Link href={`/finance?month=${shiftMonth(month, -1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href="/finance" className={buttonClass(isCurrent ? "primary" : "secondary", "sm")}>
                This month
              </Link>
              {!isCurrent && (
                <Link href={`/finance?month=${shiftMonth(month, 1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            <Link href="/finance/expenses" className={buttonClass("secondary", "sm")}>
              <Wallet className="h-4 w-4" /> Expenses
            </Link>
            <Link href={`/reports/monthly?month=${month}`} className={buttonClass("secondary", "sm")}>
              <FileText className="h-4 w-4" /> Monthly P&amp;L
            </Link>
            <Link href={`/reports/daily`} className={buttonClass("secondary", "sm")}>
              <CalendarRange className="h-4 w-4" /> Daily report
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <IconChip icon={k.icon} tone={k.tone} />
            </div>
            <div className="tabular mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">{k.value}</div>
            <div className="truncate">{k.delta}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle icon={BarChart3}>Daily collections{isCurrent ? " & 14-day forecast" : ""}</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">Hover a bar for the exact amount</p>
            </div>
          </CardHeader>
          <CardBody>
            <MoneyTrendChart data={trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={Sparkles}>{isCurrent ? "Month-end outlook" : "Month total"}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            {target > 0 ? (
              <>
                <TargetRing value={collected} target={target} projected={isCurrent ? projected : undefined} />
                <div className="text-sm text-slate-600">
                  {rupees(collected)} of {rupees(target)} target
                </div>
              </>
            ) : (
              <Banner tone="info" className="text-left">
                Set a monthly collection target in{" "}
                <Link href="/settings" className="font-semibold underline">
                  Settings
                </Link>{" "}
                to track progress here.
              </Banner>
            )}
            {isCurrent && (
              <div className="w-full rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-200">
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Projected by month-end</div>
                <div className="tabular text-2xl font-bold text-slate-900">{rupees(projected)}</div>
                <div className="text-xs text-slate-500">
                  Likely {inrShort(projectedLow)} – {inrShort(projectedHigh)}
                  {target > 0 && (
                    <span className={cn("ml-1 font-medium", projected >= target ? "text-emerald-700" : "text-amber-700")}>
                      · {projected >= target ? "on track" : `${inrShort(target - projected)} short`}
                    </span>
                  )}
                </div>
              </div>
            )}
            {cap && (
              <div className="w-full rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-200">
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">OPD slots booked · next 7 days</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="tabular text-2xl font-bold text-slate-900">{cap.utilisation}%</span>
                  <span className="text-xs text-slate-500">
                    {cap.booked} of {cap.total} slots
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: `${cap.utilisation}%`, background: SERIES.teal }} />
                </div>
              </div>
            )}
            <p className="text-[10px] leading-snug text-slate-400">
              Forecast = average of the same weekday over the last 6 weeks × recent trend; range covers ~80% of outcomes.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle icon={BarChart3}>Collections vs expenses · last 12 months</CardTitle>
          <a href={`/api/reports/export?type=pnl&month=${month}`} className={buttonClass("ghost", "sm")}>
            <Download className="h-3.5 w-3.5" /> P&amp;L CSV
          </a>
        </CardHeader>
        <CardBody>
          <RevenueExpenseChart data={months} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-slate-500">Show as table</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1.5 font-medium">Month</th>
                    <th className="py-1.5 text-right font-medium">Patients</th>
                    <th className="py-1.5 text-right font-medium">Collected</th>
                    <th className="py-1.5 text-right font-medium">Expenses</th>
                    <th className="py-1.5 text-right font-medium">Profit</th>
                    <th className="py-1.5 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-t border-slate-100">
                      <td className="py-1.5">
                        <Link href={`/finance?month=${m.month}`} className="font-medium text-brand-700 hover:underline">
                          {monthLabel(m.month, "long")}
                        </Link>
                      </td>
                      <td className="tabular py-1.5 text-right">{m.visits}</td>
                      <td className="tabular py-1.5 text-right">{rupees(m.collected)}</td>
                      <td className="tabular py-1.5 text-right">{rupees(m.expenses)}</td>
                      <td className={cn("tabular py-1.5 text-right font-semibold", m.profit < 0 && "text-rose-600")}>{rupees(m.profit)}</td>
                      <td className="tabular py-1.5 text-right">{m.collected ? `${Math.round((m.profit / m.collected) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle icon={Stethoscope}>Revenue by doctor</CardTitle>
          </CardHeader>
          <CardBody>
            <BarList items={bd.byDoctor} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle icon={ReceiptText}>Revenue by service</CardTitle>
          </CardHeader>
          <CardBody>
            <BarList items={bd.byService} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle icon={Banknote}>How patients paid</CardTitle>
          </CardHeader>
          <CardBody>
            <ModeMix items={bd.byMode} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle icon={Wallet}>Where money went</CardTitle>
            <Link href={`/finance/expenses?month=${month}`} className="text-xs font-medium text-brand-700 hover:underline">
              Details →
            </Link>
          </CardHeader>
          <CardBody>
            <BarList items={bd.byCategory.map((c) => ({ name: categoryLabel(c.name), value: c.value }))} color={SERIES.orange} empty="No expenses recorded" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/** Forecasts are estimates — show whole rupees. */
function roundRupee(paise: number) {
  return Math.round(paise / 100) * 100;
}
