// Money helpers. Pure module — safe for client components.
// Amounts are integers in paise (₹1 = 100) everywhere in the database.

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

export function modeLabel(mode: string) {
  return PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 50000 → "₹500" ; 12345 → "₹123.45" */
export function rupees(paise: number) {
  return inr.format(paise / 100);
}

/** "500" / "123.45" / "₹1,200" → paise, or null when not a valid amount. */
export function toPaise(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[₹,\s]/g, "");
  if (s === "" || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Paise → plain rupee string for form inputs ("500", "123.45"). */
export function rupeeInput(paise: number) {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Part-paid",
  paid: "Paid",
  refunded: "Refunded",
  void: "Void",
};

/** Invoice status from its totals. */
export function invoiceStatus(total: number, paid: number, refunded: boolean) {
  if (refunded && paid <= 0) return "refunded";
  if (total <= 0 || paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}
