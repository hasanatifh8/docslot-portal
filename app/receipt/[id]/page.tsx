import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { modeLabel, rupees } from "@/lib/money";
import { Logo } from "@/components/brand";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Receipt · DocSlot" };

/** A5-friendly payment receipt. Opens in a new tab; Ctrl+P or the button prints it. */
export default async function ReceiptPage({ params }: PageProps<"/receipt/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "billing.view")) notFound();
  const { id } = await params;
  const inv = await prisma.invoice.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      patient: true,
      clinic: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "asc" }, include: { receivedBy: { select: { name: true } } } },
      visit: { select: { token: true, doctor: { select: { name: true } } } },
    },
  });
  if (!inv) notFound();
  const tz = inv.clinic.timezone;

  return (
    <div className="min-h-dvh bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <Logo className="h-7" />
            <div className="mt-2 text-base font-semibold text-slate-900">{inv.clinic.name}</div>
            {inv.clinic.addressText && <div className="text-xs text-slate-500">{inv.clinic.addressText}</div>}
            {inv.clinic.phone && <div className="text-xs text-slate-500">Ph: {inv.clinic.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Receipt</div>
            <div className="font-mono text-sm font-semibold text-slate-900">{inv.number}</div>
            <div className="text-xs text-slate-500">{fmt(inv.createdAt, tz, "d MMM yyyy, h:mm a")}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 py-4 text-sm">
          <div>
            <div className="text-[11px] text-slate-500 uppercase">Patient</div>
            <div className="font-medium text-slate-900">{inv.patient.name}</div>
            <div className="text-xs text-slate-500">
              {inv.patient.uhid} · +{inv.patient.waPhone}
            </div>
          </div>
          {inv.visit && (
            <div className="text-right">
              <div className="text-[11px] text-slate-500 uppercase">Consultant</div>
              <div className="font-medium text-slate-900">{inv.visit.doctor.name}</div>
              <div className="text-xs text-slate-500">OPD token #{inv.visit.token}</div>
            </div>
          )}
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-500 uppercase">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-800">{i.description}</td>
                <td className="tabular py-2 text-right text-slate-600">{i.qty}</td>
                <td className="tabular py-2 text-right text-slate-900">{rupees(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="tabular">{rupees(inv.subtotal)}</span>
          </div>
          {inv.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="tabular">− {rupees(inv.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular">{rupees(inv.total)}</span>
          </div>
          {inv.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-slate-600">
              <span>
                {p.kind === "refund" ? "Refunded" : "Paid"} by {modeLabel(p.mode)} · {fmt(p.createdAt, tz, "d MMM, h:mm a")}
                {p.reference && ` · ${p.reference}`}
              </span>
              <span className="tabular">
                {p.kind === "refund" ? "−" : ""}
                {rupees(p.amount)}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-1 font-semibold">
            <span>Balance</span>
            <span className="tabular">{rupees(Math.max(0, inv.total - inv.paid))}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400">Computer-generated receipt · {inv.clinic.name}</p>
        <div className="mt-6 flex justify-center">
          <PrintButton label="Print receipt" />
        </div>
      </div>
    </div>
  );
}
