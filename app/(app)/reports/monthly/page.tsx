import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FileText } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { rupees } from "@/lib/money";
import { breakdowns, categoryLabel, dailySeries, monthBounds, monthLabel, shiftMonth } from "@/lib/finance";
import { pctChange } from "@/lib/forecast";
import { Card, CardBody, CardHeader, CardTitle, PageHeader, buttonClass, cn } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { Delta } from "@/components/mini-charts";

/** Profit & loss statement for one month (cash basis), with last month alongside. */
export default async function MonthlyReportPage({ searchParams }: PageProps<"/reports/monthly">) {
  const user = await requirePermission("reports.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const thisMonth = dayRange(tz).day.slice(0, 7);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : thisMonth;
  const prev = shiftMonth(month, -1);
  const cur = monthBounds(month, tz);
  const pre = monthBounds(prev, tz);
  const endDay = (m: string, days: number) => `${m}-${String(days).padStart(2, "0")}`;

  const [days, prevDays, bd, bdPrev, invoices, invoicesPrev, appts] = await Promise.all([
    dailySeries(user.clinicId, tz, cur.startDay, endDay(month, cur.days)),
    dailySeries(user.clinicId, tz, pre.startDay, endDay(prev, pre.days)),
    breakdowns(user.clinicId, cur.start, cur.end, cur.startDay, endDay(month, cur.days)),
    breakdowns(user.clinicId, pre.start, pre.end, pre.startDay, endDay(prev, pre.days)),
    prisma.invoice.findMany({ where: { clinicId: user.clinicId, createdAt: { gte: cur.start, lt: cur.end }, status: { not: "void" } }, select: { subtotal: true, discount: true, total: true, paid: true } }),
    prisma.invoice.findMany({ where: { clinicId: user.clinicId, createdAt: { gte: pre.start, lt: pre.end }, status: { not: "void" } }, select: { subtotal: true, discount: true, total: true } }),
    prisma.appointment.findMany({ where: { clinicId: user.clinicId, startAt: { gte: cur.start, lt: cur.end } }, select: { status: true } }),
  ]);

  // For the month in progress, compare with the same days of last month.
  const isCurrent = month === thisMonth;
  const todayN = Number(dayRange(tz).day.slice(8));
  const prevLike = isCurrent ? prevDays.filter((d) => Number(d.date.slice(8)) <= todayN) : prevDays;
  const total = (rows: typeof days, k: "collected" | "expenses" | "visits" | "newVisits" | "followUps") => rows.reduce((s, r) => s + r[k], 0);
  const collected = total(days, "collected");
  const collectedPrev = total(prevDays, "collected");
  const collectedLike = total(prevLike, "collected");
  const spentLike = total(prevLike, "expenses");
  const spent = total(days, "expenses");
  const spentPrev = total(prevDays, "expenses");
  const profit = collected - spent;
  const profitPrev = collectedPrev - spentPrev;
  const gross = invoices.reduce((s, i) => s + i.subtotal, 0);
  const discounts = invoices.reduce((s, i) => s + i.discount, 0);
  const unpaid = invoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
  const visits = total(days, "visits");
  const noShow = appts.filter((a) => a.status === "no_show").length;
  const attended = appts.filter((a) => a.status === "completed").length;
  const busiest = [...days].sort((a, b) => b.visits - a.visits)[0];
  const prevService = new Map(bdPrev.byService.map((s) => [s.name, s.value]));
  const prevCat = new Map(bdPrev.byCategory.map((s) => [s.name, s.value]));
  const cats = [...new Set([...bd.byCategory.map((c) => c.name), ...bdPrev.byCategory.map((c) => c.name)])];

  return (
    <div className="space-y-5 print:space-y-3">
      <PageHeader
        icon={FileText}
        title="Monthly P&L report"
        description={`${user.clinic.name} · ${monthLabel(month, "long")}`}
        actions={
          <div className="no-print flex items-center gap-1">
            <Link href={`/reports/monthly?month=${prev}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {month < thisMonth && (
              <Link href={`/reports/monthly?month=${shiftMonth(month, 1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
            <PrintButton />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Collected" value={rupees(collected)} delta={<Delta pct={pctChange(collected, collectedLike)} suffix={isCurrent ? "vs same days last month" : "vs last month"} />} />
        <Kpi label="Expenses" value={rupees(spent)} delta={<Delta pct={pctChange(spent, spentLike)} goodWhenUp={false} suffix={isCurrent ? "vs same days last month" : "vs last month"} />} />
        <Kpi label="Net profit" value={rupees(profit)} delta={<Delta pct={pctChange(profit, collectedLike - spentLike)} suffix={isCurrent ? "vs same days last month" : "vs last month"} />} tone={profit < 0 ? "text-rose-600" : undefined} />
        <Kpi label="Patients seen" value={String(visits)} delta={<span className="text-[11px] text-slate-500">{visits ? rupees(Math.round(collected / visits / 100) * 100) : "—"} per patient</span>} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit &amp; loss statement</CardTitle>
          <p className="mt-0.5 text-xs text-slate-500">Cash basis: income when received, expenses when paid.</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium" />
                <th className="px-3 py-2 text-right font-medium">{monthLabel(month)}</th>
                <th className="px-5 py-2 text-right font-medium">{monthLabel(prev)}</th>
              </tr>
            </thead>
            <tbody>
              <Section title="Income billed" />
              {bd.byService.map((s) => (
                <Line key={s.name} label={s.name} a={s.value} b={prevService.get(s.name) ?? 0} indent />
              ))}
              <Line label="Gross billed" a={gross} b={invoicesPrev.reduce((s, i) => s + i.subtotal, 0)} />
              <Line label="Less: discounts" a={-discounts} b={-invoicesPrev.reduce((s, i) => s + i.discount, 0)} indent />
              <Line label="Net billed" a={gross - discounts} b={invoicesPrev.reduce((s, i) => s + i.total, 0)} strong />
              <Line label="Not yet collected (this month's bills)" a={unpaid} muted />
              <Line label="Cash collected (incl. older dues, net of refunds)" a={collected} b={collectedPrev} strong />
              <Section title="Expenses" />
              {cats.map((c) => (
                <Line key={c} label={categoryLabel(c)} a={bd.byCategory.find((x) => x.name === c)?.value ?? 0} b={prevCat.get(c) ?? 0} indent />
              ))}
              <Line label="Total expenses" a={spent} b={spentPrev} strong />
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-5 py-3 font-bold text-slate-900">Net profit</td>
                <td className={cn("tabular px-3 py-3 text-right text-base font-bold", profit < 0 ? "text-rose-600" : "text-brand-800")}>{rupees(profit)}</td>
                <td className="tabular px-5 py-3 text-right font-semibold text-slate-600">{rupees(profitPrev)}</td>
              </tr>
              <tr>
                <td className="px-5 py-2 text-slate-500">Profit margin</td>
                <td className="tabular px-3 py-2 text-right">{collected ? `${Math.round((profit / collected) * 100)}%` : "—"}</td>
                <td className="tabular px-5 py-2 text-right text-slate-500">{collectedPrev ? `${Math.round((profitPrev / collectedPrev) * 100)}%` : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Pair label="Patients seen" value={`${visits} (${total(days, "newVisits")} new · ${total(days, "followUps")} follow-up)`} />
            <Pair label="Average per working day" value={String(Math.round(visits / Math.max(1, days.filter((d) => d.visits > 0).length)))} />
            <Pair label="Busiest day" value={busiest && busiest.visits ? `${fmt(new Date(`${busiest.date}T12:00:00Z`), "UTC", "EEE d MMM")} · ${busiest.visits} patients` : "—"} />
            <Pair label="Appointments" value={`${appts.length} booked · ${noShow} no-show${noShow + attended ? ` (${Math.round((noShow / (noShow + attended)) * 100)}%)` : ""}`} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Collections by doctor</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            {bd.byDoctor.map((d) => (
              <Pair key={d.name} label={d.name} value={rupees(d.value)} />
            ))}
            {bd.byDoctor.length === 0 && <p className="text-slate-400">No collections</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Day by day</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Patients</th>
                <th className="px-3 py-2 text-right font-medium">Collected</th>
                <th className="px-3 py-2 text-right font-medium">Expenses</th>
                <th className="px-5 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.visits || d.collected || d.expenses)
                .map((d) => (
                  <tr key={d.date} className="border-b border-slate-50">
                    <td className="px-5 py-1.5">
                      <Link href={`/reports/daily?date=${d.date}`} className="text-brand-700 hover:underline print:text-slate-800 print:no-underline">
                        {fmt(new Date(`${d.date}T12:00:00Z`), "UTC", "EEE d MMM")}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">{d.visits}</td>
                    <td className="tabular px-3 py-1.5 text-right">{rupees(d.collected)}</td>
                    <td className="tabular px-3 py-1.5 text-right">{d.expenses ? rupees(d.expenses) : "—"}</td>
                    <td className={cn("tabular px-5 py-1.5 text-right font-medium", d.collected - d.expenses < 0 && "text-rose-600")}>{rupees(d.collected - d.expenses)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="hidden pt-6 text-xs text-slate-500 print:block">
        Prepared by {user.name} · {fmt(new Date(), tz, "d MMM yyyy")} · Computer-generated from DocSlot HMS records
      </p>
    </div>
  );
}

function Kpi({ label, value, delta, tone }: { label: string; value: string; delta: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn("tabular mt-1 text-xl font-semibold text-slate-900", tone)}>{value}</div>
      {delta}
    </Card>
  );
}
function Section({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={3} className="px-5 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </td>
    </tr>
  );
}
function Line({ label, a, b, indent, strong, muted }: { label: string; a: number; b?: number; indent?: boolean; strong?: boolean; muted?: boolean }) {
  return (
    <tr className={cn(strong && "border-t border-slate-200")}>
      <td className={cn("px-5 py-1.5", indent && "pl-9", strong ? "font-semibold text-slate-900" : muted ? "text-slate-400" : "text-slate-700")}>{label}</td>
      <td className={cn("tabular px-3 py-1.5 text-right", strong && "font-semibold", muted && "text-slate-400")}>{rupees(a)}</td>
      <td className="tabular px-5 py-1.5 text-right text-slate-500">{b != null ? rupees(b) : ""}</td>
    </tr>
  );
}
function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="tabular text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
