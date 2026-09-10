"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { frontdeskBook, type BookState } from "@/app/actions/appointments";
import { Button, Card, Field, Input, Select } from "@/components/ui";

type Doctor = { id: string; name: string; specialty: string };

export function FrontdeskForm({ doctors }: { doctors: Doctor[] }) {
  const [state, action, pending] = useActionState<BookState, FormData>(frontdeskBook, {});
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (detailsRef.current) detailsRef.current.open = false;
    }
  }, [state.ok]);

  return (
    <details ref={detailsRef} className="group mb-6">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
        <Plus className="h-4 w-4 text-slate-400 transition group-open:rotate-45" />
        Book manually (front desk)
      </summary>
      <Card className="mt-3 p-5">
        <form ref={formRef} action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/10 sm:col-span-2">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/10 sm:col-span-2">
              Appointment booked.
            </p>
          )}
          <Field label="Doctor">
            <Select name="doctorId" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Patient name">
            <Input name="patientName" placeholder="Rahul Verma" />
          </Field>
          <Field label="WhatsApp number" hint="With country code, e.g. 919812345678">
            <Input name="waPhone" required placeholder="919812345678" inputMode="numeric" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" name="date" required />
            </Field>
            <Field label="Time">
              <Input type="time" name="time" required />
            </Field>
          </div>
          <Field label="Note (optional)" className="sm:col-span-2">
            <Input name="note" placeholder="Follow-up visit" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Booking…" : "Book appointment"}
            </Button>
          </div>
        </form>
      </Card>
    </details>
  );
}
