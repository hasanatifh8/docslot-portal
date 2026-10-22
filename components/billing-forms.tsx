"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Banknote, CreditCard, IndianRupee, Percent, Plus, ReceiptText, Smartphone, Undo2, Wallet, X } from "lucide-react";
import { addInvoiceItem, applyDiscount, collectPayment, createInvoice, refundPayment, removeInvoiceItem, voidInvoice } from "@/app/actions/billing";
import { Banner, Button, Chip, Field, Input, Select, cn } from "@/components/ui";
import { PatientPicker, type PickedPatient } from "@/components/patient-picker";
import { useToast } from "@/components/toast";
import { rupeeInput, rupees, toPaise } from "@/lib/money";

const MODES = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "other", label: "Other", icon: Wallet },
];

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string; ok?: boolean; message?: string }>, success: string, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) return setError(res.error);
      toast({ tone: "success", title: res.message ?? success });
      after?.();
      router.refresh();
    });
  return { run, pending, error, setError };
}

/** Collect — amount defaults to the balance; quick-cash buttons for change calculation. */
export function PaymentPanel({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const { run, pending, error } = useRun();
  const [mode, setMode] = useState("cash");
  const [amount, setAmount] = useState(rupeeInput(balance));
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const paise = toPaise(amount);
  const tenderedPaise = toPaise(tendered);
  const change = mode === "cash" && tenderedPaise && paise ? tenderedPaise - paise : null;
  const over = paise != null && paise > balance;

  if (balance <= 0) return null;
  return (
    <div className="space-y-4">
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <Chip key={m.value} active={mode === m.value} onClick={() => setMode(m.value)} className="h-10 px-4 text-sm">
            <m.icon className="h-4 w-4" />
            {m.label}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount received (₹)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-invalid={over} className="tabular h-12 text-xl font-semibold" />
          {over && <span className="mt-1 block text-xs text-red-600">More than the {rupees(balance)} due</span>}
        </Field>
        {mode === "cash" ? (
          <Field label="Cash tendered (optional)" hint={change != null && change >= 0 ? `Return change: ${rupees(change)}` : "To work out change"}>
            <Input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="tabular h-12 text-lg" />
            <div className="mt-1.5 flex gap-1.5">
              {[100, 200, 500, 2000].filter((n) => n * 100 >= balance).slice(0, 3).map((n) => (
                <button key={n} type="button" onClick={() => setTendered(String(n))} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                  ₹{n}
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <Field label={mode === "upi" ? "UPI transaction ID" : mode === "card" ? "Card last 4 / approval code" : "Reference"} hint="Optional, helps reconciliation">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-12 font-mono" />
          </Field>
        )}
      </div>
      <Button
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending || !paise || over}
        onClick={() => run(() => collectPayment({ invoiceId, amount, mode, reference }), "Payment received")}
      >
        <IndianRupee className="h-4 w-4" />
        {pending ? "Saving…" : `Receive ${paise ? rupees(paise) : ""}`}
      </Button>
    </div>
  );
}

export function AddItemForm({ invoiceId, services }: { invoiceId: string; services: { id: string; name: string; price: number }[] }) {
  const { run, pending, error } = useRun();
  const [custom, setCustom] = useState(false);
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  return (
    <div className="space-y-2">
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <Chip key={s.id} disabled={pending} onClick={() => run(() => addInvoiceItem({ invoiceId, serviceId: s.id }), `${s.name} added`)}>
            <Plus className="h-3 w-3" /> {s.name} · {rupees(s.price)}
          </Chip>
        ))}
        <Chip active={custom} onClick={() => setCustom((c) => !c)}>
          Other charge…
        </Chip>
      </div>
      {custom && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
          <Field label="Description" className="min-w-48 flex-1">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Medical certificate" />
          </Field>
          <Field label="Price (₹)" className="w-28">
            <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" />
          </Field>
          <Field label="Qty" className="w-20">
            <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          </Field>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => addInvoiceItem({ invoiceId, description: desc, price, qty }), "Charge added", () => {
                setDesc("");
                setPrice("");
                setQty("1");
              })
            }
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

export function RemoveItemButton({ itemId }: { itemId: string }) {
  const { run, pending, error } = useRun();
  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? "Remove"}
      onClick={() => run(() => removeInvoiceItem(itemId), "Item removed")}
      className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600", error && "text-rose-500")}
      aria-label="Remove item"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

const DISCOUNT_REASONS = ["Senior citizen", "Staff / family", "Doctor's discretion", "Financial hardship"];
const REFUND_REASONS = ["Visit cancelled", "Charged twice", "Doctor unavailable", "Billing error"];

/** Admin-only adjustments, tucked behind a disclosure so they're never hit by accident. */
export function AdjustmentForms({ invoiceId, subtotal, discount, paid, canVoid }: { invoiceId: string; subtotal: number; discount: number; paid: number; canVoid: boolean }) {
  const { run, pending, error } = useRun();
  const [tab, setTab] = useState<"discount" | "refund" | "void" | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("cash");
  const pick = (t: typeof tab) => {
    setTab(tab === t ? null : t);
    setAmount(t === "discount" ? rupeeInput(discount) : t === "refund" ? rupeeInput(paid) : "");
    setReason("");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip active={tab === "discount"} onClick={() => pick("discount")}>
          <Percent className="h-3.5 w-3.5" /> Discount
        </Chip>
        {paid > 0 && (
          <Chip active={tab === "refund"} tone="amber" onClick={() => pick("refund")}>
            <Undo2 className="h-3.5 w-3.5" /> Refund
          </Chip>
        )}
        {canVoid && (
          <Chip active={tab === "void"} tone="rose" onClick={() => pick("void")}>
            <Ban className="h-3.5 w-3.5" /> Void bill
          </Chip>
        )}
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      {tab && (
        <div className="step-in space-y-3 rounded-xl bg-slate-50 p-3">
          {tab !== "void" && (
            <div className="flex flex-wrap gap-2">
              <Field label={`${tab === "discount" ? "Discount" : "Refund"} amount (₹)`} className="w-40">
                <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="tabular" />
              </Field>
              {tab === "discount" && (
                <div className="flex items-end gap-1">
                  {[10, 20, 50, 100].map((pct) => (
                    <button key={pct} type="button" onClick={() => setAmount(rupeeInput(Math.round((subtotal * pct) / 100)))} className="h-10 rounded-lg bg-white px-2.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50">
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
              {tab === "refund" && (
                <Field label="Refund by" className="w-36">
                  <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                    {MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          )}
          <Field label="Reason (required — recorded in the audit log)">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {(tab === "discount" ? DISCOUNT_REASONS : REFUND_REASONS).map((r) => (
                <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                  {r}
                </Chip>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button
            variant={tab === "void" ? "danger" : "primary"}
            disabled={pending}
            onClick={() =>
              tab === "discount"
                ? run(() => applyDiscount({ invoiceId, amount, reason }), "Discount applied", () => setTab(null))
                : tab === "refund"
                  ? run(() => refundPayment({ invoiceId, amount, mode, reason }), "Refund recorded", () => setTab(null))
                  : run(() => voidInvoice({ invoiceId, reason }), "Bill voided", () => setTab(null))
            }
          >
            {tab === "discount" ? "Apply discount" : tab === "refund" ? "Record refund" : "Void this bill"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function NewBillButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ReceiptText className="h-4 w-4" /> New bill
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-brand-950/30 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-label="New bill" className="dialog-in w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-semibold text-slate-900">New bill</h2>
              <p className="text-xs text-slate-500">For services outside an OPD visit — dressing, injection, certificate.</p>
            </div>
            {error && <Banner tone="danger">{error}</Banner>}
            <PatientPicker autoFocus value={patient} onChange={setPatient} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!patient || pending}
                onClick={() =>
                  start(async () => {
                    const res = await createInvoice(patient!.id);
                    if (res.error || !res.id) return setError(res.error ?? "Couldn't create the bill");
                    router.push(`/billing/${res.id}`);
                  })
                }
              >
                Create bill
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
