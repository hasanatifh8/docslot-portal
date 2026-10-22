"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AlertTriangle, BadgeCheck, Banknote, CreditCard, IndianRupee, Siren, Smartphone, Stethoscope, Timer } from "@/components/icons";
import { checkIn, quoteCheckIn, type CheckInQuote } from "@/app/actions/opd";
import { Banner, Button, Chip, Field, Input, buttonClass, cn } from "@/components/ui";
import { PatientPicker, type PickedPatient } from "@/components/patient-picker";
import { useToast } from "@/components/toast";
import { COMPLAINTS, PRIORITIES } from "@/lib/quick-picks";
import { rupees } from "@/lib/money";

export type QueueDoctor = { id: string; name: string; specialty: string; room: string | null; waiting: number };

const PAY_MODES = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "later", label: "Pay later", icon: Timer },
] as const;

export function CheckInPanel({
  doctors,
  initialPatient = null,
  canCollect,
  onClose,
}: {
  doctors: QueueDoctor[];
  initialPatient?: PickedPatient | null;
  canCollect: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  // Smart default: same doctor as last time, else the only doctor.
  const defaultDoctor = (p: PickedPatient | null) =>
    !p ? null : p.lastDoctorId && doctors.some((d) => d.id === p.lastDoctorId) ? p.lastDoctorId : doctors.length === 1 ? doctors[0].id : null;
  const [patient, setPatientState] = useState<PickedPatient | null>(initialPatient);
  const [doctorId, setDoctorId] = useState<string | null>(() => defaultDoctor(initialPatient));
  const setPatient = (p: PickedPatient | null) => {
    setPatientState(p);
    setDoctorId(defaultDoctor(p));
  };
  const [complaints, setComplaints] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [priority, setPriority] = useState("normal");
  const [mode, setMode] = useState<string>(canCollect ? "cash" : "later");
  const [reference, setReference] = useState("");
  const [quoted, setQuoted] = useState<{ key: string; q: CheckInQuote } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ token: number; doctor: string; room: string | null; visitId: string; paid: number; due: number } | null>(null);

  // Fee preview, remembered per patient+doctor so a stale quote never shows.
  const quoteKey = patient && doctorId ? `${patient.id}:${doctorId}` : null;
  const quote = quoted && quoted.key === quoteKey ? quoted.q : null;
  useEffect(() => {
    if (!quoteKey) return;
    let live = true;
    const [pid, did] = quoteKey.split(":");
    quoteCheckIn(pid, did).then((q) => live && setQuoted({ key: quoteKey, q }));
    return () => {
      live = false;
    };
  }, [quoteKey]);

  const fee = quote?.fee ?? 0;
  const complaint = [...complaints, other.trim()].filter(Boolean).join(", ");

  function submit() {
    if (!patient || !doctorId) return;
    setError(null);
    start(async () => {
      const res = await checkIn({
        patientId: patient.id,
        doctorId,
        complaint,
        priority,
        payment: mode !== "later" && fee > 0 ? { mode, reference } : null,
      });
      if (res.error || !res.visitId || res.token == null) {
        setError(res.error ?? "Couldn't check in.");
        return;
      }
      toast({
        tone: "success",
        title: `Token #${res.token} — ${patient.name}`,
        body: res.paid ? `${rupees(res.paid)} collected` : res.due ? `${rupees(res.due)} due at billing` : undefined,
      });
      setDone({ token: res.token, doctor: res.doctor!, room: res.room ?? null, visitId: res.visitId, paid: res.paid ?? 0, due: res.due ?? 0 });
      router.refresh();
    });
  }

  const reset = () => {
    setDone(null);
    setPatient(null);
    setComplaints([]);
    setOther("");
    setPriority("normal");
    setReference("");
    setMode(canCollect ? "cash" : "later");
  };

  if (done) {
    return (
      <div className="step-in flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-700/30">
          <span className="text-[10px] font-semibold tracking-widest text-brand-100 uppercase">Token</span>
          <span className="tabular text-4xl leading-none font-extrabold">{done.token}</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{patient?.name}</p>
          <p className="text-sm text-slate-500">
            {done.doctor}
            {done.room && ` · Room ${done.room}`}
          </p>
          <p className={cn("mt-1 text-sm font-medium", done.due > 0 ? "text-amber-700" : "text-emerald-700")}>
            {done.paid > 0 ? `${rupees(done.paid)} collected` : done.due > 0 ? `${rupees(done.due)} due at billing` : "No charge"}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Check in next patient</Button>
          <Link href={`/opd/${done.visitId}`} className={buttonClass("secondary", "md")}>
            Open visit
          </Link>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <Banner tone="danger" icon={AlertTriangle}>
          {error}
        </Banner>
      )}

      <div>
        <Label n={1}>Patient</Label>
        <PatientPicker autoFocus={!patient} value={patient} onChange={setPatient} />
      </div>

      {patient && (
        <>
          <div>
            <Label n={2}>Doctor</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDoctorId(d.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition",
                    doctorId === d.id ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-slate-200 hover:ring-brand-300"
                  )}
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", doctorId === d.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{d.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {d.specialty}
                      {d.room && ` · Rm ${d.room}`}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      d.waiting === 0 ? "bg-emerald-50 text-emerald-700" : d.waiting > 8 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                    )}
                    title="Patients waiting"
                  >
                    {d.waiting} waiting
                  </span>
                </button>
              ))}
            </div>
            {quote?.openVisit && (
              <Banner tone="warn" icon={AlertTriangle} className="mt-3">
                Already in today&apos;s queue — token #{quote.openVisit.token} with {quote.openVisit.doctor}.{" "}
                <Link href={`/opd/${quote.openVisit.id}`} className="font-semibold underline">
                  Open visit
                </Link>
              </Banner>
            )}
          </div>

          <div>
            <Label n={3}>Reason for visit</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMPLAINTS.slice(0, 14).map((c) => (
                <Chip key={c} active={complaints.includes(c)} onClick={() => setComplaints((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>
                  {c}
                </Chip>
              ))}
            </div>
            <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Other (optional)" className="mt-2" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Priority:</span>
              {PRIORITIES.map((p) => (
                <Chip
                  key={p.value}
                  active={priority === p.value}
                  tone={p.value === "emergency" ? "rose" : p.value === "priority" ? "amber" : "brand"}
                  onClick={() => setPriority(p.value)}
                  title={"hint" in p ? p.hint : undefined}
                >
                  {p.value === "emergency" && <Siren className="h-3.5 w-3.5" />}
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          {doctorId && (
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <Label n={4}>Consultation fee</Label>
              {quote === null ? (
                <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="tabular text-2xl font-bold text-slate-900">{rupees(fee)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", quote.visitType === "follow_up" ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800")}>
                      {quote.visitType === "follow_up" ? "Follow-up" : "New visit"}
                    </span>
                    <span className="text-xs text-slate-500">{quote.reason}</span>
                  </div>
                  {fee > 0 && canCollect && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {PAY_MODES.map((m) => (
                          <Chip key={m.value} active={mode === m.value} onClick={() => setMode(m.value)}>
                            <m.icon className="h-3.5 w-3.5" />
                            {m.label}
                          </Chip>
                        ))}
                      </div>
                      {(mode === "upi" || mode === "card") && (
                        <Field label={mode === "upi" ? "UPI transaction ID (optional)" : "Card last 4 / approval code (optional)"}>
                          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="max-w-xs font-mono" />
                        </Field>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button size="lg" onClick={submit} disabled={!patient || !doctorId || !quote || !!quote.openVisit || pending}>
          {mode !== "later" && fee > 0 ? <IndianRupee className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
          {pending ? "Checking in…" : mode !== "later" && fee > 0 && canCollect ? `Collect ${rupees(fee)} & issue token` : "Issue token"}
        </Button>
      </div>
    </div>
  );
}

function Label({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] text-brand-700">{n}</span>
      {children}
    </div>
  );
}

/** Slide-over wrapper so check-in never leaves the queue screen. */
export function CheckInDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="OPD check-in"
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "step-in .2s ease-out" }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">OPD check-in</h2>
            <p className="text-xs text-slate-500">Patient → doctor → reason → fee. Token is issued instantly.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-slim flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
