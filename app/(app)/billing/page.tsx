import Link from "next/link";
import { Banknote, CalendarRange, ChevronLeft, ChevronRight, IndianRupee, ReceiptText, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { INVOICE_STATUS_LABELS, PAYMENT_MODES, rupees } from "@/lib/money";
import { Badge, Card, CardHeader, CardTitle, EmptyState, IconChip, PageHeader, buttonClass, chipClass, cn } from "@/components/ui";
import { NewBillButton } from "@/components/billing-forms";

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePermission("billing.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const today = dayRange(tz).day;
  const { day, start, end } = dayRange(tz, typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today);
  const filter = typeof sp.status === "string" ? sp.status : "due";

  const [invoices, payments, olderDue] = await Promise.all([
    prisma.invoice.findMany({
      where: { clinicId: user.clinicId, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      include: { patient: { select: { id: true, name: true, uhid: true } }, visit: { select: { token: true, doctor: { select: { name: true } } } } },
    }),
    prisma.payment.findMany({ where: { invoice: { clinicId: user.clinicId }, createdAt: { gte: start, lt: end } } }),
    prisma.invoice.findMany({
      where: { clinicId: user.clinicId, createdAt: { lt: start }, status: { in: ["unpaid", "partial"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { patient: { select: { id: true, name: true, uhid: true } }, visit: { select: { token: true, doctor: { select: { name: true } } } } },
    }),
  ]);

  const net = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
  const collected = payments.reduce((s, p) => s + net(p), 0);
  const byMode = PAYMENT_MODES.map((m) => ({ ...m, total: payments.filter((p) => p.mode === m.value).reduce((s, p) => s + net(p), 0) })).filter((m) => m.total !== 0);
  const dueToday = invoices.filter((i) => i.status === "unpaid" || i.status === "partial");
  const dueAmount = dueToday.reduce((s, i) => s + i.total - i.paid, 0);
  const shown = (filter === "due" ? dueToday : filter === "paid" ? invoices.filter((i) => i.status === "paid") : invoices).concat(filter === "due" ? olderDue : []);
  const href = (o: Record<string, string>) => `/billing?${new URLSearchParams({ date: day, status: filter, ...o })}`;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={IndianRupee}
        title="Billing & receipts"
        description={`${fmt(start, tz, "EEEE, d MMMM yyyy")}${day === today ? " · today" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/billing/day-end?date=${day}`} className={buttonClass("secondary", "md")}>
              <CalendarRange className="h-4 w-4" /> Day-end report
            </Link>
            <NewBillButton />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-500">Collected (net)</span>
            <IconChip icon={Banknote} tone="emerald" />
          </div>
          <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{rupees(collected)}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
            {byMode.length ? byMode.map((m) => <span key={m.value}>{m.label} {rupees(m.total)}</span>) : "No payments yet"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-500">Due on this day&apos;s bills</span>
            <IconChip icon={Wallet} tone="amber" />
          </div>
          <div className={cn("tabular mt-1 text-2xl font-semibold", dueAmount ? "text-amber-700" : "text-slate-900")}>{rupees(dueAmount)}</div>
          <div className="mt-1 text-[11px] text-slate-500">{dueToday.length} bill{dueToday.length === 1 ? "" : "s"} pending</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-500">Bills raised</span>
            <IconChip icon={ReceiptText} tone="brand" />
          </div>
          <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{invoices.filter((i) => i.status !== "void").length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Total {rupees(invoices.filter((i) => i.status !== "void").reduce((s, i) => s + i.total, 0))}</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={href({ date: shift(day, -1) })} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={href({ date: today })} className={buttonClass(day === today ? "primary" : "secondary", "sm")}>
            Today
          </Link>
          <Link href={href({ date: shift(day, 1) })} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex gap-1.5 sm:ml-auto">
          {[
            ["due", "To collect"],
            ["paid", "Paid"],
            ["all", "All"],
          ].map(([v, l]) => (
            <Link key={v} href={href({ status: v })} className={chipClass(filter === v)}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle icon={ReceiptText}>{filter === "due" ? "Waiting for payment" : filter === "paid" ? "Paid bills" : "All bills"}</CardTitle>
        </CardHeader>
        {shown.length === 0 ? (
          <EmptyState icon={ReceiptText} title={filter === "due" ? "Nothing to collect" : "No bills"} description="Consultation bills are created automatically at OPD check-in." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((i) => {
              const balance = i.total - i.paid;
              const old = i.createdAt < start;
              return (
                <li key={i.id}>
                  <Link href={`/billing/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap sm:px-5">
                    <div className="w-28 shrink-0">
                      <div className="font-mono text-xs font-semibold text-slate-700">{i.number}</div>
                      <div className="text-[11px] text-slate-400">{fmt(i.createdAt, tz, old ? "d MMM" : "h:mm a")}</div>
                    </div>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {i.patient.name} <span className="font-normal text-slate-400">· {i.patient.uhid}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500">{i.visit ? `Token #${i.visit.token} · ${i.visit.doctor.name}` : "Services"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="tabular text-sm font-semibold text-slate-900">{rupees(i.total)}</div>
                        {balance > 0 && i.status !== "void" && <div className="tabular text-[11px] font-medium text-amber-700">{rupees(balance)} due</div>}
                      </div>
                      <Badge tone={i.status === "paid" ? "green" : i.status === "void" || i.status === "refunded" ? "slate" : "amber"}>{INVOICE_STATUS_LABELS[i.status]}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
