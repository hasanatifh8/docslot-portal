"use client";

import { useActionState } from "react";
import { createHospital, type HospitalFormState } from "@/app/actions/hospitals";
import { Button, Field, FormMessage, Input } from "@/components/ui";

export function CreateHospitalForm() {
  const [state, action, pending] = useActionState<HospitalFormState, FormData>(createHospital, {});

  // Re-key on each successful create so the fields reset.
  return (
    <form key={state.savedAt ?? 0} action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} success={state.ok} className="sm:col-span-2" />
      <Field label="Hospital name">
        <Input name="hospitalName" required placeholder="Sunrise Multispeciality Hospital" />
      </Field>
      <Field label="Code" hint="Optional — patients send it on WhatsApp. Auto-generated from the name if blank">
        <Input name="code" placeholder="sunrise" pattern="[a-zA-Z0-9\-]{2,24}" />
      </Field>
      <Field label="Administrator name">
        <Input name="adminName" required placeholder="Dr. Mehra" />
      </Field>
      <Field label="Administrator email" hint="Used to sign in">
        <Input name="adminEmail" type="email" required placeholder="admin@hospital.com" />
      </Field>
      <Field label="Temporary password" hint="At least 8 characters — share it securely">
        <Input name="password" type="text" required minLength={8} autoComplete="off" />
      </Field>
      <div className="hidden sm:block" />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create hospital"}
        </Button>
      </div>
    </form>
  );
}
