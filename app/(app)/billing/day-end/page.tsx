import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarRange } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { PAYMENT_MODES, modeLabel, rupees } from "@/lib/money";
import { Card, CardHeader, CardTitle, EmptyState, PageHeader, buttonClass, cn } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Cash-counter closing: what each person collected, by mode, net of refunds. */
export default async function DayEndPage({ searchParams }: PageProps<"/billing/day-end">) {
  const user = await requirePermission("billing.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const { day, start, end } = dayRange(tz, typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined);

  const payments = await prisma.payment.findMany({
    where: { invoice: { clinicId: user.clinicId }, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: { receivedBy: { select: { id: true, name: true } }, invoice: { select: { number: true, patient: { select: { name: true } } } } },
  });
  const net = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
  const people = [...new Map(payments.map((p) => [p.receivedBy?.id ?? "—", p.receivedBy?.name ?? "Unknown"])).entries()];
  const modes = PAYMENT_MODES.filter((m) => payments.some((p) => p.mode === m.value));
  const cell = (uid: string, mode: string) =>
    payments.filter((p) => (p.receivedBy?.id ?? "—") === uid && p.mode === mode).reduce((s, p) => s + net(p), 0);
  const total = payments.reduce((s, p) => s + net(p), 0);
  const refunds = payments.filter((p) => p.kind === "refund");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarRange}
        title="Day-end cash report"
        description={fmt(start, tz, "EEEE, d MMMM yyyy")}
        actions={
          <div className="no-print flex items-center gap-1">
            <Link href={`/billing/day-end?date=${shift(day, -1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={`/billing/day-end?date=${shift(day, 1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <PrintButton />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Collections by staff and mode</CardTitle>
        </CardHeader>
        {payments.length === 0 ? (
          <EmptyState title="No payments on this day" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-2 font-medium">Collected by</th>
                  {modes.map((m) => (
                    <th key={m.value} className="px-3 py-2 text-right font-medium">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {people.map(([uid, name]) => (
                  <tr key={uid}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{name}</td>
                    {modes.map((m) => (
                      <td key={m.value} className="tabular px-3 py-2.5 text-right text-slate-700">
                        {rupees(cell(uid, m.value))}
                      </td>
                    ))}
                    <td className="tabular px-5 py-2.5 text-right font-semibold text-slate-900">{rupees(modes.reduce((s, m) => s + cell(uid, m.value), 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-3 font-semibold">Total</td>
                  {modes.map((m) => (
                    <td key={m.value} className="tabular px-3 py-3 text-right font-semibold">
                      {rupees(payments.filter((p) => p.mode === m.value).reduce((s, p) => s + net(p), 0))}
                    </td>
                  ))}
                  <td className="tabular px-5 py-3 text-right text-lg font-bold text-brand-800">{rupees(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Refunds ({refunds.length})</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100 text-sm">
            {refunds.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>
                  <span className="font-mono text-xs">{r.invoice.number}</span> · {r.invoice.patient.name} · {r.reason}
                </span>
                <span className="tabular font-medium text-rose-700">− {rupees(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All transactions ({payments.length})</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-slate-100 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
              <span className="text-slate-700">
                <span className="tabular text-xs text-slate-400">{fmt(p.createdAt, tz, "h:mm a")}</span> · <span className="font-mono text-xs">{p.invoice.number}</span> · {p.invoice.patient.name} ·{" "}
                {modeLabel(p.mode)}
                {p.reference && ` (${p.reference})`}
              </span>
              <span className={cn("tabular font-medium", p.kind === "refund" ? "text-rose-700" : "text-slate-900")}>
                {p.kind === "refund" ? "−" : ""}
                {rupees(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
