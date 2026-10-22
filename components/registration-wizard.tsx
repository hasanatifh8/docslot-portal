"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { AlertTriangle, BadgeCheck, CalendarPlus, ClipboardPlus, HeartPulse, IdCard, Phone, UserRound, UserRoundPlus, UsersRound } from "@/components/icons";
import { createPatient } from "@/app/actions/patients";
import { Banner, Button, Card, Chip, Field, Input, buttonClass, cn } from "@/components/ui";
import { FieldError, WizardFooter, WizardSteps } from "@/components/wizard";
import { ChipInput } from "@/components/chip-input";
import { PatientAvatar } from "@/components/patient-avatar";
import { useToast } from "@/components/toast";
import { BLOOD_GROUPS, COMMON_ALLERGIES, COMMON_CONDITIONS, ID_TYPES, RELATIONS, relationLabel } from "@/lib/quick-picks";

type Member = { id: string; name: string | null; uhid: string | null; gender: string | null; age: number | null; relation: string | null };

const STEPS = ["Phone", "Patient", "Contact & ID", "Medical", "Review"];

type Form = {
  phone: string;
  name: string;
  gender: string;
  dobMode: "age" | "dob";
  age: string;
  dob: string;
  relation: string;
  bloodGroup: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  idType: string;
  idNumber: string;
  allergies: string[];
  conditions: string[];
};

const blank = (phone = ""): Form => ({
  phone,
  name: "",
  gender: "",
  dobMode: "age",
  age: "",
  dob: "",
  relation: "",
  bloodGroup: "",
  email: "",
  address: "",
  emergencyName: "",
  emergencyPhone: "",
  idType: "",
  idNumber: "",
  allergies: [],
  conditions: [],
});

const digits = (s: string) => s.replace(/\D/g, "");
/** 10-digit Indian mobile → 91XXXXXXXXXX (what we store and send WhatsApp to). */
const fullPhone = (s: string) => {
  const d = digits(s).replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
};
const phoneValid = (s: string) => {
  const d = fullPhone(s);
  return d.length >= 11 && d.length <= 15;
};

/** Age in years → approximate date of birth (1 July of that year). */
function dobFromAge(age: string) {
  const n = Number(age);
  if (!age || !Number.isFinite(n) || n < 0 || n > 120) return "";
  return `${new Date().getFullYear() - Math.floor(n)}-07-01`;
}

export function RegistrationWizard({ initialPhone = "" }: { initialPhone?: string }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(() => blank(initialPhone));
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "form", string>>>({});
  const [familyRes, setFamilyRes] = useState<{ phone: string; list: Member[] } | null>(null);
  const [dupRes, setDupRes] = useState<{ key: string; list: Member[] } | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ id: string; uhid: string; name: string } | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const dob = f.dobMode === "dob" ? f.dob : dobFromAge(f.age);
  const phoneKey = phoneValid(f.phone) ? fullPhone(f.phone) : null;
  const family = familyRes && familyRes.phone === phoneKey ? familyRes.list : null;
  const dupKey = f.name.trim().length >= 3 ? `${f.name.trim()}|${fullPhone(f.phone)}|${dob}` : null;
  const duplicates = dupRes && dupRes.key === dupKey ? dupRes.list : [];

  // Step 1: who is already registered on this number?
  useEffect(() => {
    if (!phoneKey) return;
    const ctrl = new AbortController();
    fetch(`/api/patients/lookup?phone=${phoneKey}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const list: Member[] = d.family ?? [];
        setFamilyRes({ phone: phoneKey, list });
        // Sensible default: the first person on a number is "Self".
        setF((s) => (s.relation ? s : { ...s, relation: list.length === 0 ? "self" : "" }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [phoneKey]);

  // Step 2: real-time duplicate check on name + phone / birth date.
  useEffect(() => {
    if (!dupKey) return;
    const [name, phone, birth] = dupKey.split("|");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ name, phone, ...(birth ? { dob: birth } : {}) });
      fetch(`/api/patients/lookup?${qs}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setDupRes({ key: dupKey, list: d.duplicates ?? [] }))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [dupKey]);

  function validate(i: number) {
    const e: typeof errors = {};
    if (i === 0 && !phoneValid(f.phone)) e.phone = "Enter a 10-digit mobile number";
    if (i === 1) {
      if (f.name.trim().length < 2) e.name = "Enter the patient's full name";
      if (!f.gender) e.gender = "Select a gender";
      if (f.dobMode === "age" && f.age && !dobFromAge(f.age)) e.age = "Age must be between 0 and 120";
      if (f.dobMode === "dob" && f.dob && new Date(f.dob) > new Date()) e.dob = "Date of birth can't be in the future";
      if (!f.relation) e.relation = "How is this patient related to the phone owner?";
    }
    if (i === 2) {
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email or leave it blank";
      if (f.emergencyPhone && digits(f.emergencyPhone).length < 10) e.emergencyPhone = "Needs 10 digits";
      const id = f.idNumber.replace(/\s/g, "").toUpperCase();
      if (id && !f.idType) e.idType = "Pick the ID type";
      if (id && f.idType === "aadhaar" && !/^\d{12}$/.test(id)) e.idNumber = "Aadhaar is 12 digits";
      if (id && f.idType === "abha" && !/^\d{14}$/.test(id)) e.idNumber = "ABHA number is 14 digits";
      if (id && f.idType === "pan" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(id)) e.idNumber = "PAN looks like ABCDE1234F";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => validate(step) && setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  function submit() {
    for (let i = 0; i < 4; i++) {
      if (!validate(i)) {
        setStep(i);
        return;
      }
    }
    start(async () => {
      const res = await createPatient({
        name: f.name,
        phone: f.phone,
        gender: f.gender,
        dob,
        relation: f.relation,
        bloodGroup: f.bloodGroup,
        email: f.email,
        address: f.address,
        emergencyName: f.emergencyName,
        emergencyPhone: f.emergencyPhone,
        idType: f.idType,
        idNumber: f.idNumber,
        allergies: f.allergies.join(", "),
        chronicConditions: f.conditions.join(", "),
      });
      if (res.error || !res.patientId) {
        setErrors({ form: res.error ?? "Couldn't register the patient." });
        return;
      }
      toast({ tone: "success", title: `${res.name} registered`, body: `UHID ${res.uhid}` });
      setDone({ id: res.patientId, uhid: res.uhid!, name: res.name! });
    });
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="bg-crosses relative bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <p className="text-sm text-brand-100">Patient registered</p>
          <h2 className="mt-1 text-2xl font-bold">{done.name}</h2>
          <p className="tabular mt-2 inline-flex rounded-lg bg-white/15 px-3 py-1 font-mono text-lg font-semibold tracking-wider">{done.uhid}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
          <Link href={`/opd?checkin=1&patient=${done.id}`} className={buttonClass("primary", "lg", "w-full")}>
            <ClipboardPlus className="h-4 w-4" /> Check in to OPD now
          </Link>
          <Link href={`/appointments/new?patient=${done.id}`} className={buttonClass("secondary", "lg", "w-full")}>
            <CalendarPlus className="h-4 w-4" /> Book an appointment
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setF(blank(f.phone));
              setStep(1);
            }}
            className={buttonClass("ghost", "md", "w-full")}
          >
            <UsersRound className="h-4 w-4" /> Add another family member on +{fullPhone(f.phone)}
          </button>
          <Link href={`/patients/${done.id}`} className={buttonClass("ghost", "md", "w-full")}>
            <UserRound className="h-4 w-4" /> Open patient profile
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <div className="p-5 sm:p-6">
        <WizardSteps steps={STEPS} current={step} onJump={setStep} />
        {errors.form && (
          <Banner tone="danger" icon={AlertTriangle} className="mb-4">
            {errors.form}
          </Banner>
        )}

        <div key={step} className="step-in">
          {step === 0 && (
            <section className="space-y-5">
              <StepTitle icon={Phone} title="Patient's mobile number" sub="We look up the family first, so nobody is registered twice." />
              <Field label="Mobile number (WhatsApp)" hint="10-digit Indian mobile — we add +91. Other countries: include the country code.">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">+</span>
                  <Input
                    autoFocus
                    inputMode="tel"
                    autoComplete="tel"
                    value={f.phone}
                    onChange={(e) => set("phone", e.target.value.replace(/[^\d\s+-]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
                    placeholder="98123 45678"
                    aria-invalid={!!errors.phone}
                    className="h-12 pl-7 text-lg tracking-wide"
                  />
                </div>
                <FieldError>{errors.phone}</FieldError>
              </Field>

              {family && family.length > 0 && (
                <div className="rounded-2xl bg-amber-50/70 p-4 ring-1 ring-amber-600/15">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <UsersRound className="h-4 w-4" /> Already registered on this number
                  </p>
                  <ul className="space-y-2">
                    {family.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-amber-900/5">
                        <PatientAvatar name={m.name} gender={m.gender} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{m.name || "Unnamed"}</div>
                          <div className="text-xs text-slate-500">
                            {[m.uhid, m.age != null && `${m.age} y`, relationLabel(m.relation)].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Link href={`/opd?checkin=1&patient=${m.id}`} className={buttonClass("primary", "sm")}>
                            Check in
                          </Link>
                          <Link href={`/patients/${m.id}`} className={buttonClass("secondary", "sm")}>
                            Open
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-amber-800">Registering someone else in this family? Continue — they get their own UHID.</p>
                </div>
              )}
              {family && family.length === 0 && (
                <Banner tone="success" icon={BadgeCheck}>
                  New number — nobody is registered on it yet.
                </Banner>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5">
              <StepTitle icon={UserRound} title="Who is the patient?" />
              <Field label="Full name">
                <Input
                  autoFocus
                  value={f.name}
                  onChange={(e) => set("name", e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
                  placeholder="Rahul Verma"
                  aria-invalid={!!errors.name}
                  autoComplete="off"
                />
                <FieldError>{errors.name}</FieldError>
              </Field>

              {duplicates.length > 0 && (
                <Banner tone="warn" icon={AlertTriangle} title="Possible duplicate">
                  {duplicates.map((d) => (
                    <span key={d.id} className="mr-2">
                      <Link href={`/patients/${d.id}`} className="font-semibold underline underline-offset-2">
                        {d.name} ({d.uhid})
                      </Link>
                      {d.age != null && ` · ${d.age} y`}
                    </span>
                  ))}
                  — open the existing record instead of creating a new one, if it&apos;s the same person.
                </Banner>
              )}

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Gender</span>
                <div className="flex gap-2">
                  {[
                    ["male", "Male"],
                    ["female", "Female"],
                    ["other", "Other"],
                  ].map(([v, l]) => (
                    <Chip key={v} active={f.gender === v} onClick={() => set("gender", v)} className="h-10 flex-1 justify-center text-sm sm:flex-none sm:px-6">
                      {l}
                    </Chip>
                  ))}
                </div>
                <FieldError>{errors.gender}</FieldError>
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">Age</span>
                  <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 text-xs">
                    {(["age", "dob"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set("dobMode", m)}
                        className={cn("rounded-md px-2.5 py-1 font-medium", f.dobMode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}
                      >
                        {m === "age" ? "Age in years" : "Exact date of birth"}
                      </button>
                    ))}
                  </div>
                </div>
                {f.dobMode === "age" ? (
                  <div className="flex items-center gap-3">
                    <Input
                      inputMode="numeric"
                      value={f.age}
                      onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      placeholder="35"
                      className="w-28"
                      aria-invalid={!!errors.age}
                    />
                    <span className="text-xs text-slate-400">{f.age && dobFromAge(f.age) ? `≈ born ${dobFromAge(f.age).slice(0, 4)}` : "Optional"}</span>
                  </div>
                ) : (
                  <Input type="date" value={f.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("dob", e.target.value)} className="w-52" aria-invalid={!!errors.dob} />
                )}
                <FieldError>{errors.age ?? errors.dob}</FieldError>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Relation to the phone owner</span>
                <div className="flex flex-wrap gap-1.5">
                  {RELATIONS.map((r) => (
                    <Chip key={r.value} active={f.relation === r.value} onClick={() => set("relation", r.value)}>
                      {r.label}
                    </Chip>
                  ))}
                </div>
                <FieldError>{errors.relation}</FieldError>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Blood group (optional)</span>
                <div className="flex flex-wrap gap-1.5">
                  {BLOOD_GROUPS.map((g) => (
                    <Chip key={g} active={f.bloodGroup === g} onClick={() => set("bloodGroup", f.bloodGroup === g ? "" : g)} className="w-12 justify-center">
                      {g}
                    </Chip>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <StepTitle icon={IdCard} title="Contact & identity" sub="All optional — skip if the queue is long." />
              <Field label="Address">
                <Input autoFocus value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Flat 4B, Shanti Nagar, Pune" />
              </Field>
              <Field label="Email">
                <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value.trim())} placeholder="rahul@example.com" aria-invalid={!!errors.email} />
                <FieldError>{errors.email}</FieldError>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Emergency contact name">
                  <Input value={f.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} placeholder="Priya Verma (wife)" />
                </Field>
                <Field label="Emergency contact phone">
                  <Input inputMode="tel" value={f.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} aria-invalid={!!errors.emergencyPhone} />
                  <FieldError>{errors.emergencyPhone}</FieldError>
                </Field>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Government ID</span>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {ID_TYPES.map((t) => (
                    <Chip key={t.value} active={f.idType === t.value} onClick={() => set("idType", f.idType === t.value ? "" : t.value)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
                <FieldError>{errors.idType}</FieldError>
                {f.idType && (
                  <>
                    <Input
                      value={f.idNumber}
                      onChange={(e) => set("idNumber", e.target.value.toUpperCase())}
                      inputMode={f.idType === "aadhaar" || f.idType === "abha" ? "numeric" : "text"}
                      placeholder={f.idType === "aadhaar" ? "1234 5678 9012" : f.idType === "abha" ? "14-digit ABHA number" : f.idType === "pan" ? "ABCDE1234F" : "ID number"}
                      aria-invalid={!!errors.idNumber}
                      className="max-w-xs font-mono"
                    />
                    <FieldError>{errors.idNumber}</FieldError>
                  </>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <StepTitle icon={HeartPulse} title="Medical alerts" sub="Shown in red to the doctor on every visit." />
              <div>
                <span className="mb-2 block text-xs font-medium text-slate-700">Allergies</span>
                <ChipInput value={f.allergies} onChange={(v) => set("allergies", v)} suggestions={COMMON_ALLERGIES} tone="rose" noneLabel="No known allergies" placeholder="Other allergy, e.g. Ibuprofen" />
              </div>
              <div>
                <span className="mb-2 block text-xs font-medium text-slate-700">Chronic conditions</span>
                <ChipInput value={f.conditions} onChange={(v) => set("conditions", v)} suggestions={COMMON_CONDITIONS} tone="amber" noneLabel="None" placeholder="Other condition" />
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <StepTitle icon={BadgeCheck} title="Check and register" sub="A UHID is assigned the moment you register." />
              <div className="flex items-center gap-4 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
                <PatientAvatar name={f.name} gender={f.gender} className="h-12 w-12 text-sm" />
                <div>
                  <div className="text-lg font-semibold text-slate-900">{f.name}</div>
                  <div className="text-sm text-slate-600">
                    {[
                      f.gender && f.gender[0].toUpperCase() + f.gender.slice(1),
                      f.dobMode === "age" ? f.age && `${f.age} y` : f.dob,
                      relationLabel(f.relation),
                      f.bloodGroup,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
              <ReviewBlock title="Contact" onEdit={() => setStep(0)}>
                +{fullPhone(f.phone)}
                {f.email && ` · ${f.email}`}
                {f.address && <div>{f.address}</div>}
                {f.emergencyName && <div>Emergency: {f.emergencyName} {f.emergencyPhone}</div>}
                {f.idType && <div>{ID_TYPES.find((t) => t.value === f.idType)?.label}: {f.idNumber}</div>}
              </ReviewBlock>
              <ReviewBlock title="Medical" onEdit={() => setStep(3)}>
                <div>
                  <span className="text-slate-500">Allergies:</span>{" "}
                  {f.allergies.length ? <span className="font-medium text-rose-700">{f.allergies.join(", ")}</span> : "None known"}
                </div>
                <div>
                  <span className="text-slate-500">Conditions:</span> {f.conditions.length ? f.conditions.join(", ") : "None"}
                </div>
              </ReviewBlock>
            </section>
          )}
        </div>

        <WizardFooter onBack={step > 0 ? back : undefined} hint={step < 4 ? "Press Enter for next" : undefined}>
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(3)}>
              Skip
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={next}>Continue →</Button>
          ) : (
            <Button onClick={submit} disabled={pending} size="lg">
              <UserRoundPlus className="h-4 w-4" />
              {pending ? "Registering…" : "Register patient"}
            </Button>
          )}
        </WizardFooter>
      </div>
    </Card>
  );
}

function StepTitle({ icon: Icon, title, sub }: { icon: typeof Phone; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 ring-1 ring-slate-200">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</span>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      <div className="space-y-0.5 text-sm text-slate-800">{children}</div>
    </div>
  );
}
