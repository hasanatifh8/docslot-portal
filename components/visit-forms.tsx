"use client";

import { useActionState, useState } from "react";
import { Activity, Droplet, Gauge, HeartPulse, Pill, Plus, Ruler, Thermometer, Weight, Wind, X } from "lucide-react";
import { saveConsultation, saveVitals, type OpdFormState } from "@/app/actions/opd";
import { Button, Field, FormMessage, Input, Textarea } from "@/components/ui";

type Vitals = {
  heightCm: number | null;
  weightKg: number | null;
  temperatureC: number | null;
  pulse: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  respRate: number | null;
};

const dv = (n: number | null) => (n == null ? "" : String(n));

export function VitalsForm({ visitId, vitals }: { visitId: string; vitals: Vitals }) {
  const [state, action, pending] = useActionState<OpdFormState, FormData>(saveVitals, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} success={state.ok && "Saved."} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="BP systolic" hint="mmHg" icon={Gauge}>
          <Input name="bpSystolic" type="number" inputMode="numeric" defaultValue={dv(vitals.bpSystolic)} placeholder="120" />
        </Field>
        <Field label="BP diastolic" hint="mmHg" icon={Gauge}>
          <Input name="bpDiastolic" type="number" inputMode="numeric" defaultValue={dv(vitals.bpDiastolic)} placeholder="80" />
        </Field>
        <Field label="Pulse" hint="bpm" icon={HeartPulse}>
          <Input name="pulse" type="number" inputMode="numeric" defaultValue={dv(vitals.pulse)} placeholder="72" />
        </Field>
        <Field label="SpO₂" hint="%" icon={Droplet}>
          <Input name="spo2" type="number" inputMode="numeric" defaultValue={dv(vitals.spo2)} placeholder="98" />
        </Field>
        <Field label="Temperature" hint="°C" icon={Thermometer}>
          <Input name="temperatureC" type="number" step="0.1" inputMode="decimal" defaultValue={dv(vitals.temperatureC)} placeholder="36.8" />
        </Field>
        <Field label="Resp. rate" hint="/min" icon={Wind}>
          <Input name="respRate" type="number" inputMode="numeric" defaultValue={dv(vitals.respRate)} placeholder="16" />
        </Field>
        <Field label="Height" hint="cm" icon={Ruler}>
          <Input name="heightCm" type="number" step="0.1" inputMode="decimal" defaultValue={dv(vitals.heightCm)} />
        </Field>
        <Field label="Weight" hint="kg" icon={Weight}>
          <Input name="weightKg" type="number" step="0.1" inputMode="decimal" defaultValue={dv(vitals.weightKg)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="complete" disabled={pending}>
          {pending ? "Saving…" : "Complete triage → send to doctor"}
        </Button>
        <span className="text-xs text-slate-400">BP, pulse, temperature and SpO₂ are required to complete.</span>
      </div>
    </form>
  );
}

type RxRow = {
  key: number;
  medicine: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

type Consultation = {
  chiefComplaint: string | null;
  history: string | null;
  examination: string | null;
  diagnosis: string | null;
  advice: string | null;
  followUpDate: string; // yyyy-MM-dd or ""
};

const blankRow = (key: number): RxRow => ({
  key,
  medicine: "",
  dosage: null,
  frequency: null,
  duration: null,
  instructions: null,
});

export function ConsultationForm({
  visitId,
  values,
  prescription,
}: {
  visitId: string;
  values: Consultation;
  prescription: Omit<RxRow, "key">[];
}) {
  const [state, action, pending] = useActionState<OpdFormState, FormData>(saveConsultation, {});
  const [rows, setRows] = useState<RxRow[]>(() =>
    prescription.length ? prescription.map((r, i) => ({ ...r, key: i })) : [blankRow(0)]
  );
  const nextKey = () => Math.max(-1, ...rows.map((r) => r.key)) + 1;

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} success={state.ok && "Draft saved."} />
      <input type="hidden" name="visitId" value={visitId} />

      <Field label="Chief complaint" icon={Activity}>
        <Input name="chiefComplaint" defaultValue={values.chiefComplaint ?? ""} placeholder="Fever for 3 days" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="History">
          <Textarea name="history" rows={3} defaultValue={values.history ?? ""} />
        </Field>
        <Field label="Examination findings">
          <Textarea name="examination" rows={3} defaultValue={values.examination ?? ""} />
        </Field>
      </div>
      <Field label="Diagnosis">
        <Input name="diagnosis" defaultValue={values.diagnosis ?? ""} placeholder="Acute viral fever" />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Pill className="h-3.5 w-3.5 text-brand-500" />
          Prescription (℞)
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 rounded-xl bg-brand-50/50 p-2 ring-1 ring-brand-100 sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto]">
              <div className="relative col-span-2 sm:col-span-1">
                <Pill className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-brand-400" />
                <Input name="rx.medicine" defaultValue={r.medicine} placeholder="Medicine" aria-label="Medicine" className="pl-9" />
              </div>
              <Input name="rx.dosage" defaultValue={r.dosage ?? ""} placeholder="500 mg" aria-label="Dosage" />
              <Input name="rx.frequency" defaultValue={r.frequency ?? ""} placeholder="1-0-1" aria-label="Frequency" />
              <Input name="rx.duration" defaultValue={r.duration ?? ""} placeholder="5 days" aria-label="Duration" />
              <Input name="rx.instructions" defaultValue={r.instructions ?? ""} placeholder="After food" aria-label="Instructions" />
              <button
                type="button"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow(nextKey())]))}
                className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove medicine"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setRows((rs) => [...rs, blankRow(nextKey())])}>
          <Plus className="h-3.5 w-3.5" />
          Add medicine
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Advice">
          <Textarea name="advice" rows={2} defaultValue={values.advice ?? ""} placeholder="Plenty of fluids, rest" />
        </Field>
        <Field label="Follow-up on">
          <Input name="followUpDate" type="date" defaultValue={values.followUpDate} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="complete" disabled={pending}>
          {pending ? "Finalizing…" : "Finalize prescription & complete"}
        </Button>
        <span className="self-center text-xs text-slate-400">Generates the PDF and locks the visit.</span>
      </div>
    </form>
  );
}
