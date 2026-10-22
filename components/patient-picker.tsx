"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Search, UserRoundPlus, X } from "lucide-react";
import { createPatient } from "@/app/actions/patients";
import { Button, Chip, Field, Input, cn } from "@/components/ui";
import { FieldError } from "@/components/wizard";
import { PatientAvatar } from "@/components/patient-avatar";
import { usePatientSearch, type PatientHit } from "@/components/command-palette";
import { relationLabel } from "@/lib/quick-picks";

export type PickedPatient = PatientHit & { allergies?: string | null; lastDoctorId?: string | null };

/** Live search with keyboard navigation, plus a 3-field quick registration. */
export function PatientPicker({
  value,
  onChange,
  autoFocus,
  allowCreate = true,
}: {
  value: PickedPatient | null;
  onChange: (p: PickedPatient | null) => void;
  autoFocus?: boolean;
  allowCreate?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rawActive, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const { hits, loading } = usePatientSearch(q);
  const active = Math.min(rawActive, Math.max(0, hits.length - 1));

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50/60 p-3 ring-1 ring-brand-200">
        <PatientAvatar name={value.name} gender={value.gender} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{value.name || "Unnamed patient"}</div>
          <div className="truncate text-xs text-slate-500">
            {[value.uhid, value.age != null && `${value.age} y`, value.gender, `+${value.waPhone}`].filter(Boolean).join(" · ")}
          </div>
          {value.allergies && (
            <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" /> Allergies: {value.allergies}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
        >
          <X className="h-3.5 w-3.5" /> Change
        </button>
      </div>
    );
  }

  if (creating) return <QuickCreate initial={q} onCancel={() => setCreating(false)} onCreated={(p) => onChange(p)} />;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              onChange(hits[active]);
            }
          }}
          placeholder="Search by name, UHID or mobile number…"
          className="h-12 pl-10 text-base"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="patient-results"
          autoComplete="off"
        />
      </div>
      <ul id="patient-results" role="listbox" className="mt-2 space-y-1">
        {loading && hits.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>}
        {hits.map((p, i) => (
          <li key={p.id} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => onChange(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition",
                i === active ? "bg-brand-50 ring-brand-200" : "ring-transparent hover:bg-slate-50"
              )}
            >
              <PatientAvatar name={p.name} gender={p.gender} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{p.name || "Unnamed"}</div>
                <div className="truncate text-xs text-slate-500">
                  {[p.uhid, p.age != null && `${p.age} y`, relationLabel(p.relation), `+${p.waPhone}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              {i === active && <span className="text-[11px] font-medium text-brand-600">Enter ↵</span>}
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !loading && hits.length === 0 && (
          <li className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No patient matches “{q.trim()}”.</li>
        )}
      </ul>
      {allowCreate && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
        >
          <UserRoundPlus className="h-4 w-4" /> New patient — quick register
        </button>
      )}
    </div>
  );
}

function QuickCreate({
  initial,
  onCancel,
  onCreated,
}: {
  initial: string;
  onCancel: () => void;
  onCreated: (p: PickedPatient) => void;
}) {
  const looksLikePhone = /^\+?[\d\s-]{6,}$/.test(initial.trim());
  const [name, setName] = useState(looksLikePhone ? "" : initial.trim());
  const [phone, setPhone] = useState(looksLikePhone ? initial.trim() : "");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState<{ field?: string; msg: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const dob = age && Number(age) <= 120 ? `${new Date().getFullYear() - Number(age)}-07-01` : "";
      const res = await createPatient({ name, phone, gender, dob, relation: "self" });
      if (res.error || !res.patientId) {
        setError({ field: res.field, msg: res.error ?? "Couldn't register" });
        return;
      }
      onCreated({
        id: res.patientId,
        name: res.name!,
        uhid: res.uhid!,
        waPhone: phone.replace(/\D/g, "").length === 10 ? `91${phone.replace(/\D/g, "")}` : phone.replace(/\D/g, ""),
        gender,
        age: age ? Number(age) : null,
        relation: "self",
      });
    });

  return (
    <div className="space-y-4 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Quick register</span>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to search
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={error?.field === "name"} />
        </Field>
        <Field label="Mobile">
          <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98123 45678" aria-invalid={error?.field === "phone"} />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-700">Gender</span>
          <div className="flex gap-1.5">
            {["male", "female", "other"].map((g) => (
              <Chip key={g} active={gender === g} onClick={() => setGender(g)} className="capitalize">
                {g}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Age" className="w-24">
          <Input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </Field>
      </div>
      <FieldError>{error?.msg}</FieldError>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Full details can be added later from the profile.</span>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Register & use"}
        </Button>
      </div>
    </div>
  );
}
