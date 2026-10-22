"use client";

import { useActionState } from "react";
import { createLead, type LeadState } from "@/app/actions/leads";
import { Button, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import { CheckCircle2 } from "@/components/icons";

export function DemoForm() {
  const [state, action, pending] = useActionState<LeadState, FormData>(createLead, {});
  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Thank you — we&apos;ll call you shortly</h3>
        <p className="max-w-sm text-sm text-slate-500">Our team will set up a personalised demo with your departments and doctors.</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} className="sm:col-span-2" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Your name">
        <Input name="name" required autoComplete="name" />
      </Field>
      <Field label="Mobile">
        <Input name="phone" required inputMode="tel" autoComplete="tel" placeholder="98123 45678" />
      </Field>
      <Field label="Hospital / clinic" className="sm:col-span-2">
        <Input name="hospital" required autoComplete="organization" />
      </Field>
      <Field label="Email (optional)">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="City">
        <Input name="city" autoComplete="address-level2" />
      </Field>
      <Field label="Size" className="sm:col-span-2">
        <Select name="size" defaultValue="">
          <option value="">Select…</option>
          <option>Clinic (1–3 doctors)</option>
          <option>Polyclinic (4–10 doctors)</option>
          <option>Hospital (10–50 beds)</option>
          <option>Hospital (50+ beds)</option>
        </Select>
      </Field>
      <Field label="Anything we should know? (optional)" className="sm:col-span-2">
        <Textarea name="message" rows={3} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Book my free demo"}
        </Button>
        <p className="mt-2 text-center text-[11px] text-slate-400">We&apos;ll only use your details to contact you about DocSlot.</p>
      </div>
    </form>
  );
}
