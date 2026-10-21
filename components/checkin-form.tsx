"use client";

import { useActionState } from "react";
import { checkInWalkIn, type OpdFormState } from "@/app/actions/opd";
import { Button, FormMessage, Input, Select } from "@/components/ui";

type Doctor = { id: string; name: string; specialty: string };

/** Walk-in OPD check-in for one known patient. */
export function CheckInForm({ patientId, doctors }: { patientId: string; doctors: Doctor[] }) {
  const [state, action, pending] = useActionState<OpdFormState, FormData>(checkInWalkIn, {});
  return (
    <form action={action} className="space-y-2">
      <FormMessage error={state.error} />
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="doctorId" required defaultValue="" className="sm:w-56">
          <option value="" disabled>
            Doctor…
          </option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.specialty}
            </option>
          ))}
        </Select>
        <Input name="chiefComplaint" placeholder="Reason for visit (optional)" className="flex-1" />
        <Button type="submit" disabled={pending}>
          {pending ? "Checking in…" : "Check in"}
        </Button>
      </div>
    </form>
  );
}
