"use client";

import { useActionState } from "react";
import { saveService, type BillingResult } from "@/app/actions/billing";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import { useActionToast } from "@/components/toast";

export function ServiceForm() {
  const [state, action, pending] = useActionState<BillingResult, FormData>(saveService, {});
  useActionToast(state, "Price list updated");
  return (
    <form action={action} key={state.savedAt ?? 0} className="flex flex-wrap items-end gap-2">
      <FormMessage error={state.error} className="w-full" />
      <Field label="Service" className="min-w-48 flex-1">
        <Input name="name" required placeholder="Dressing (small)" />
      </Field>
      <Field label="Price (₹)" className="w-28">
        <Input name="price" required inputMode="decimal" placeholder="150" />
      </Field>
      <Button variant="secondary" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
