"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import Link from "next/link";
import { addDoctor, type DoctorFormState } from "@/app/actions/config";
import { createDoctorLogin, type StaffFormState } from "@/app/actions/staff";
import { KeyRound } from "@/components/icons";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";

/**
 * Submit through the action without React's automatic form reset, so a
 * rejected submit (duplicate email, short password) keeps what was typed.
 */
function keepValues(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

export function AddDoctorForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<DoctorFormState, FormData>(addDoctor, {});

  // Re-key on each successful add so the fields reset.
  return (
    <form key={state.savedAt ?? 0} onSubmit={keepValues(action)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} success={state.ok} className="sm:col-span-2" />
      <Field label="Name">
        <Input name="name" required placeholder="Dr. Mehra" />
      </Field>
      <Field label="Specialty">
        <Input name="specialty" required placeholder="Cardiologist" />
      </Field>
      <Field label="Department">
        <Select name="departmentId" defaultValue="">
          <option value="">None</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Qualification" hint="Printed on prescriptions">
        <Input name="qualification" placeholder="MBBS, MD" />
      </Field>
      <Field label="Registration no." hint="Medical council registration">
        <Input name="registrationNo" placeholder="MMC 123456" />
      </Field>
      <div className="hidden sm:block" />
      <Field label="Slot length" hint="Minutes per appointment">
        <Input name="slotMinutes" type="number" defaultValue={15} min={5} max={240} />
      </Field>
      <Field label="Buffer" hint="Gap between appointments, minutes">
        <Input name="bufferMinutes" type="number" defaultValue={0} min={0} max={120} />
      </Field>
      <Field label="Consultation fee (₹)" hint="New visit">
        <Input name="consultFee" inputMode="decimal" defaultValue="500" />
      </Field>
      <Field label="Follow-up fee (₹)" hint="Within the follow-up window">
        <Input name="followUpFee" inputMode="decimal" defaultValue="0" />
      </Field>
      <Field label="Follow-up window" hint="Days after a visit that count as follow-up">
        <Input name="followUpDays" type="number" defaultValue={7} min={0} max={60} />
      </Field>
      <Field label="Room / cabin" hint="Shown on the token display">
        <Input name="room" placeholder="3" />
      </Field>

      <fieldset className="rounded-xl bg-brand-50/60 p-4 ring-1 ring-brand-100 sm:col-span-2">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-brand-600" /> Sign-in for this doctor
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          Optional — fill in to let the doctor sign in and consult their own patients. They&apos;ll set their own password the
          first time. You can also do this later.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Sign-in email">
            <Input name="loginEmail" type="email" placeholder="dr.mehra@hospital.com" autoComplete="off" />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters — share it securely">
            <Input name="loginPassword" type="text" minLength={8} autoComplete="off" />
          </Field>
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add doctor"}
        </Button>
      </div>
    </form>
  );
}

/** Sign-in status for one doctor, with a create form when there's none yet. */
export function DoctorLogin({ doctorId, login }: { doctorId: string; login: { email: string; active: boolean } | null }) {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(createDoctorLogin, {});
  if (login) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2 text-sm ring-1 ring-emerald-200/70">
        <KeyRound className="h-4 w-4 text-emerald-600" />
        <span className="text-slate-700">
          Signs in as <span className="font-medium text-slate-900">{login.email}</span>
          {!login.active && <span className="text-rose-600"> · deactivated</span>}
        </span>
        <Link href="/staff" className="ml-auto text-xs font-medium text-brand-700 hover:underline">
          Reset password / manage in Staff →
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={keepValues(action)} className="space-y-2 rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-200/70">
      <input type="hidden" name="doctorId" value={doctorId} />
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        <KeyRound className="h-4 w-4 text-amber-600" /> No sign-in yet — create one so this doctor can log in
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Sign-in email" className="min-w-0 flex-1 basis-56">
          <Input name="email" type="email" required placeholder="doctor@hospital.com" autoComplete="off" className="h-9" />
        </Field>
        <Field label="Temporary password" className="min-w-0 flex-1 basis-44">
          <Input name="password" type="text" required minLength={8} autoComplete="off" className="h-9" />
        </Field>
        <Button size="sm" disabled={pending} className="mb-0.5">
          {pending ? "Creating…" : "Create sign-in"}
        </Button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
