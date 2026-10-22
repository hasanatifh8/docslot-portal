"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addExpense, type ExpenseState } from "@/app/actions/finance";
import { Button, Chip, Field, FormMessage, Input, Select } from "@/components/ui";
import { useActionToast } from "@/components/toast";
import { EXPENSE_CATEGORIES } from "@/lib/finance-shared";

const MODES = [
  ["bank", "Bank transfer"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["card", "Card"],
  ["cheque", "Cheque"],
];

/** Quick expense entry: category chips, amount, date defaults to today. */
export function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<ExpenseState, FormData>(addExpense, {});
  const [category, setCategory] = useState("consumables");
  useActionToast(state, "Expense recorded");
  return (
    <form key={state.savedAt ?? 0} action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <input type="hidden" name="category" value={category} />
      <div className="flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Description">
          <Input name="description" required placeholder="Gloves, syringes (monthly stock)" />
        </Field>
        <Field label="Amount (₹)">
          <Input name="amount" required inputMode="decimal" placeholder="4500" className="tabular" />
        </Field>
        <Field label="Date">
          <Input name="date" type="date" required defaultValue={today} max={today} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_1fr]">
        <Field label="Paid by">
          <Select name="mode" defaultValue="bank">
            {MODES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor (optional)">
          <Input name="vendor" placeholder="MedSupply Pune" />
        </Field>
        <Field label="Bill / ref no. (optional)">
          <Input name="reference" className="font-mono" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="recurring" className="h-4 w-4 accent-brand-600" />
          Repeats every month (rent, salaries, subscriptions)
        </label>
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "Saving…" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
