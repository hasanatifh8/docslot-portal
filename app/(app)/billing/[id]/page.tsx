import Link from "next/link";
import { notFound } from "next/navigation";
import { History, IndianRupee, Printer, ReceiptText, SlidersHorizontal } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { INVOICE_STATUS_LABELS, modeLabel, rupees } from "@/lib/money";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, buttonClass, cn } from "@/components/ui";
import { AddItemForm, AdjustmentForms, PaymentPanel, RemoveItemButton } from "@/components/billing-forms";

export default async function InvoicePage({ params }: PageProps<"/billing/[id]">) {
  const user = await requirePermission("billing.view");
  const tz = user.clinic.timezone;
  const { id } = await params;
  const inv = await prisma.invoice.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      patient: true,
      visit: { select: { id: true, token: true, visitType: true, doctor: { select: { name: true } } } },
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "asc" }, include: { receivedBy: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  if (!inv) notFound();
  const services = await prisma.serviceItem.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" } });

  const balance = inv.total - inv.paid;
  const open = inv.status !== "void" && inv.status !== "refunded";
  const canCollect = can(user.role, "billing.collect") && open;
  const canAdjust = can(user.role, "billing.adjust") && inv.status !== "void";

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ReceiptText}
        title={`Bill ${inv.number}`}
        description={`${fmt(inv.createdAt, tz, "d MMM yyyy, h:mm a")}${inv.createdBy ? ` · by ${inv.createdBy.name}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Badge tone={inv.status === "paid" ? "green" : inv.status === "void" || inv.status === "refunded" ? "slate" : "amber"} className="h-8 px-3 text-sm">
              {INVOICE_STATUS_LABELS[inv.status]}
            </Badge>
            {inv.paid > 0 && (
              <Link href={`/receipt/${inv.id}`} target="_blank" className={buttonClass("secondary", "sm")}>
                <Printer className="h-3.5 w-3.5" /> Print receipt
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <Link href={`/patients/${inv.patient.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700">
                  {inv.patient.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {inv.patient.uhid} · +{inv.patient.waPhone}
                </div>
              </div>
              {inv.visit && (
                <Link href={`/opd/${inv.visit.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  Token #{inv.visit.token} · {inv.visit.doctor.name} →
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle icon={ReceiptText}>Charges</CardTitle>
            </CardHeader>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Rate</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inv.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                      No charges yet — add from the price list below.
                    </td>
                  </tr>
                )}
                {inv.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2.5 text-slate-800">{i.description}</td>
                    <td className="tabular px-2 py-2.5 text-right text-slate-600">{i.qty}</td>
                    <td className="tabular px-2 py-2.5 text-right text-slate-600">{rupees(i.unitPrice)}</td>
                    <td className="tabular px-5 py-2.5 text-right font-medium text-slate-900">{rupees(i.amount)}</td>
                    <td className="pr-3">{canCollect && inv.paid === 0 && <RemoveItemButton itemId={i.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canCollect && (
              <div className="border-t border-slate-100 p-5">
                <AddItemForm invoiceId={inv.id} services={services} />
              </div>
            )}
          </Card>

          {inv.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={History}>Payments</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-slate-100">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <span className={cn("font-medium", p.kind === "refund" ? "text-rose-700" : "text-slate-900")}>
                        {p.kind === "refund" ? "Refund" : "Received"} · {modeLabel(p.mode)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {" "}
                        · {fmt(p.createdAt, tz, "d MMM, h:mm a")}
                        {p.receivedBy && ` · ${p.receivedBy.name}`}
                        {p.reference && ` · ref ${p.reference}`}
                        {p.reason && ` · ${p.reason}`}
                      </span>
                    </div>
                    <span className={cn("tabular font-semibold", p.kind === "refund" ? "text-rose-700" : "text-emerald-700")}>
                      {p.kind === "refund" ? "−" : "+"}
                      {rupees(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <Row label="Subtotal" value={rupees(inv.subtotal)} />
              {inv.discount > 0 && <Row label={`Discount${inv.discountReason ? ` (${inv.discountReason})` : ""}`} value={`− ${rupees(inv.discount)}`} tone="text-emerald-700" />}
              <Row label="Total" value={rupees(inv.total)} strong />
              <Row label="Paid" value={rupees(inv.paid)} />
              <div className={cn("flex items-baseline justify-between rounded-xl px-3 py-2.5", balance > 0 && open ? "bg-amber-50" : "bg-emerald-50")}>
                <span className="font-semibold text-slate-700">{balance > 0 ? "Balance due" : "Settled"}</span>
                <span className={cn("tabular text-2xl font-bold", balance > 0 && open ? "text-amber-700" : "text-emerald-700")}>{rupees(Math.max(0, balance))}</span>
              </div>
            </CardBody>
          </Card>

          {canCollect && balance > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={IndianRupee}>Collect payment</CardTitle>
              </CardHeader>
              <CardBody>
                <PaymentPanel key={balance} invoiceId={inv.id} balance={balance} />
              </CardBody>
            </Card>
          )}

          {canAdjust && (
            <Card>
              <CardHeader>
                <CardTitle icon={SlidersHorizontal}>Adjustments</CardTitle>
              </CardHeader>
              <CardBody>
                <AdjustmentForms invoiceId={inv.id} subtotal={inv.subtotal} discount={inv.discount} paid={inv.paid} canVoid={inv.paid === 0} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-slate-500", strong && "font-semibold text-slate-800")}>{label}</span>
      <span className={cn("tabular", strong ? "text-base font-semibold text-slate-900" : "text-slate-800", tone)}>{value}</span>
    </div>
  );
}
