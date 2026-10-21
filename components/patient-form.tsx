"use client";

import { useActionState } from "react";
import { registerPatient, updatePatient, type PatientFormState } from "@/app/actions/patients";
import { Button, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";

export type PatientFormValues = {
  id: string;
  name: string | null;
  waPhone: string;
  gender: string | null;
  dob: string; // yyyy-MM-dd or ""
  bloodGroup: string | null;
  email: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  allergies: string | null;
  chronicConditions: string | null;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function PatientForm({ patient }: { patient?: PatientFormValues }) {
  const [state, action, pending] = useActionState<PatientFormState, FormData>(
    patient ? updatePatient : registerPatient,
    {}
  );
  const v = patient;

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} success={state.ok && "Patient details saved."} className="sm:col-span-2" />
      {v && <input type="hidden" name="id" value={v.id} />}

      <Field label="Full name" className="sm:col-span-2">
        <Input name="name" required defaultValue={v?.name ?? ""} placeholder="Rahul Verma" />
      </Field>
      <Field label="Phone (WhatsApp)" hint="With country code, e.g. 919812345678">
        <Input name="phone" required inputMode="numeric" defaultValue={v?.waPhone ?? ""} placeholder="919812345678" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <Select name="gender" required defaultValue={v?.gender ?? ""}>
            <option value="" disabled>
              Select…
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input name="dob" type="date" defaultValue={v?.dob ?? ""} />
        </Field>
      </div>
      <Field label="Blood group">
        <Select name="bloodGroup" defaultValue={v?.bloodGroup ?? ""}>
          <option value="">Unknown</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={v?.email ?? ""} placeholder="rahul@example.com" />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Input name="address" defaultValue={v?.address ?? ""} placeholder="Flat 4B, Shanti Nagar, Pune" />
      </Field>
      <Field label="Emergency contact name">
        <Input name="emergencyName" defaultValue={v?.emergencyName ?? ""} placeholder="Priya Verma (wife)" />
      </Field>
      <Field label="Emergency contact phone">
        <Input name="emergencyPhone" inputMode="tel" defaultValue={v?.emergencyPhone ?? ""} />
      </Field>
      <Field label="Allergies" className="sm:col-span-2">
        <Input name="allergies" defaultValue={v?.allergies ?? ""} placeholder="Penicillin, peanuts" />
      </Field>
      <Field label="Chronic conditions" className="sm:col-span-2">
        <Textarea
          name="chronicConditions"
          rows={2}
          defaultValue={v?.chronicConditions ?? ""}
          placeholder="Type 2 diabetes, hypertension"
        />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : v ? "Save changes" : "Register patient"}
        </Button>
      </div>
    </form>
  );
}
