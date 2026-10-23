"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Plus, X } from "lucide-react";
import { AlertTriangle, BookmarkPlus, CalendarClock, FileCheck2, History, LayoutTemplate, ListChecks, MessageCircle, Pill, Repeat2, Sparkles, Stethoscope, Trash2 } from "@/components/icons";
import { deleteTemplate, saveConsultation, saveTemplate } from "@/app/actions/opd";
import { Banner, Button, Chip, Input, Kbd, Textarea, cn } from "@/components/ui";
import { FlaskConical } from "lucide-react";
import { Autocomplete } from "@/components/autocomplete";
import { MicButton, appendText } from "@/components/voice-input";
import { useToast } from "@/components/toast";
import { DURATIONS, FREQUENCIES, INSTRUCTIONS, searchDrugs, type DrugDefault } from "@/lib/drugs";
import { searchIcd, type Icd } from "@/lib/icd10";
import { ADVICE, COMPLAINTS, EXAM_FINDINGS, FOLLOW_UPS } from "@/lib/quick-picks";
import { allergyConflict, clinicalSummary, type VitalKey } from "@/lib/clinical";

export type RxItem = { medicine: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null };
export type Template = {
  id: string;
  name: string;
  mine: boolean;
  shared: boolean;
  chiefComplaint: string | null;
  examination: string | null;
  diagnosis: string | null;
  icdCode: string | null;
  advice: string | null;
  items: RxItem[];
};

type Row = RxItem & { key: number };
type Notes = {
  chiefComplaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  icdCode: string;
  advice: string;
  followUpDate: string;
};

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const blankRow = (key: number): Row => ({ key, medicine: "", dosage: null, frequency: null, duration: null, instructions: null });
const fmtDate = (s: string) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

/**
 * The doctor's screen: one page, top-to-bottom in consultation order, with
 * templates, one-tap phrases, dictation, drug/ICD auto-complete and a live
 * clinical summary. Drafts auto-save; finalizing locks the record.
 */
export function ConsultationWorkspace({
  visitId,
  initial,
  initialItems,
  patient,
  vitals,
  visitType,
  templates: initialTemplates,
  favourites,
  lastRx,
  labs,
}: {
  visitId: string;
  initial: Notes;
  initialItems: RxItem[];
  patient: { name: string | null; age: number | null; gender: string | null; allergies: string | null; chronicConditions: string | null; waPhone: string };
  vitals: Partial<Record<VitalKey, number | null>>;
  visitType: string;
  templates: Template[];
  favourites: DrugDefault[];
  lastRx: { date: string; diagnosis: string | null; items: RxItem[] } | null;
  /** Latest lab summary + currently abnormal values (from uploaded reports). */
  labs?: { href: string; headline: string | null; title: string | null; date: string | null; abnormal: { test: string; value: string; unit: string | null; flag: string }[] } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [n, setN] = useState<Notes>(initial);
  const [rows, setRows] = useState<Row[]>(() => (initialItems.length ? initialItems.map((r, i) => ({ ...r, key: i })) : [blankRow(0)]));
  const [templates, setTemplates] = useState(initialTemplates);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sendRx, setSendRx] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);
  const [pending, start] = useTransition();
  const keyRef = useRef(rows.length);

  const set = <K extends keyof Notes>(k: K, v: Notes[K]) => {
    setN((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };
  const setRow = (key: number, patch: Partial<RxItem>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const addRow = (item?: Partial<RxItem>) => {
    setRows((rs) => {
      const filled = rs.filter((r) => r.medicine.trim());
      return [...filled, { ...blankRow(keyRef.current++), ...item }];
    });
    setDirty(true);
  };

  const items = rows.filter((r) => r.medicine.trim());
  const conflicts = useMemo(() => new Map(rows.map((r) => [r.key, allergyConflict(r.medicine, patient.allergies)])), [rows, patient.allergies]);
  const anyConflict = [...conflicts.values()].some(Boolean);

  const summary = clinicalSummary({
    patient: { name: patient.name, age: patient.age, gender: patient.gender, allergies: patient.allergies, chronicConditions: patient.chronicConditions },
    visitType,
    vitals,
    chiefComplaint: n.chiefComplaint,
    history: n.history,
    examination: n.examination,
    diagnosis: n.diagnosis,
    icdCode: n.icdCode,
    items,
    advice: n.advice,
    followUp: fmtDate(n.followUpDate),
  });

  const formData = useCallback(
    (intent: "save" | "complete") => {
      const fd = new FormData();
      fd.set("visitId", visitId);
      fd.set("intent", intent);
      for (const [k, v] of Object.entries(n)) fd.set(k, v);
      for (const r of items) {
        fd.append("rx.medicine", r.medicine);
        fd.append("rx.dosage", r.dosage ?? "");
        fd.append("rx.frequency", r.frequency ?? "");
        fd.append("rx.duration", r.duration ?? "");
        fd.append("rx.instructions", r.instructions ?? "");
      }
      if (sendRx) fd.set("sendRx", "on");
      return fd;
    },
    [n, items, visitId, sendRx]
  );

  const saveDraft = useCallback(
    (quiet = false) =>
      start(async () => {
        const res = await saveConsultation({}, formData("save"));
        if (res.error) {
          setError(res.error);
          return;
        }
        setDirty(false);
        setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
        if (!quiet) toast({ tone: "success", title: "Draft saved" });
      }),
    [formData, toast]
  );

  const finalize = () =>
    start(async () => {
      const res = await saveConsultation({}, formData("complete"));
      if (res.error) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      setDirty(false);
      toast({ tone: "success", title: "Prescription finalized", body: res.message });
      router.refresh();
    });

  // Auto-save every 40 s while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveDraft(true), 40_000);
    return () => clearTimeout(t);
  }, [dirty, saveDraft]);

  // Ctrl/⌘+S = save draft, Ctrl/⌘+Enter = finalize.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!n.diagnosis.trim()) setError("Add a diagnosis before finalizing.");
        else setConfirming(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDraft, n.diagnosis]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function applyTemplate(t: Template) {
    setN((s) => ({
      ...s,
      chiefComplaint: s.chiefComplaint || t.chiefComplaint || "",
      examination: t.examination ? appendText(s.examination, t.examination) : s.examination,
      diagnosis: t.diagnosis ?? s.diagnosis,
      icdCode: t.icdCode ?? (t.diagnosis ? "" : s.icdCode),
      advice: t.advice ? appendText(s.advice, t.advice) : s.advice,
    }));
    if (t.items.length) {
      setRows((rs) => {
        const kept = rs.filter((r) => r.medicine.trim());
        const have = new Set(kept.map((r) => r.medicine.toLowerCase()));
        return [...kept, ...t.items.filter((i) => !have.has(i.medicine.toLowerCase())).map((i) => ({ ...i, key: keyRef.current++ }))];
      });
    }
    setDirty(true);
    toast({ tone: "info", title: `Template “${t.name}” applied`, body: "Review and adjust before finalizing." });
  }

  const searchIcdCb = useCallback((q: string) => searchIcd(q), []);
  const searchDrugCb = useCallback((q: string) => searchDrugs(q, favourites), [favourites]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        {error && (
          <Banner tone="danger" icon={AlertTriangle} action={<button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>}>
            {error}
          </Banner>
        )}

        {/* Templates */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-violet-50/60 p-3 ring-1 ring-violet-200/60">
          <LayoutTemplate className="mr-1 h-4 w-4 text-violet-600" />
          <span className="mr-1 text-xs font-semibold text-violet-900">Templates</span>
          {templates.length === 0 && <span className="text-xs text-violet-800/70">Save your common cases once, apply in one tap.</span>}
          {templates.map((t) => (
            <span key={t.id} className="group inline-flex items-center">
              <Chip onClick={() => applyTemplate(t)} className="ring-violet-200" title={t.shared ? "Shared template" : "Your template"}>
                {t.name}
              </Chip>
              {t.mine && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteTemplate(t.id);
                    setTemplates((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                  className="ml-0.5 hidden h-6 w-6 items-center justify-center rounded-full text-slate-400 group-hover:flex hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Delete template ${t.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          <button type="button" onClick={() => setSavingTpl(true)} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100">
            <BookmarkPlus className="h-3.5 w-3.5" /> Save current as template
          </button>
        </div>
        {savingTpl && (
          <SaveTemplate
            onCancel={() => setSavingTpl(false)}
            onSave={async (name, shared) => {
              const res = await saveTemplate({ name, shared, ...n, items });
              if (res.error) return res.error;
              setTemplates((ts) => [
                ...ts,
                { id: res.id!, name, mine: true, shared, chiefComplaint: n.chiefComplaint, examination: n.examination, diagnosis: n.diagnosis, icdCode: n.icdCode, advice: n.advice, items },
              ]);
              setSavingTpl(false);
              toast({ tone: "success", title: `Template “${name}” saved` });
              return null;
            }}
          />
        )}

        {/* Complaint & history */}
        <Section icon={Stethoscope} title="Presenting complaint">
          <QuickRow items={COMPLAINTS} onPick={(c) => set("chiefComplaint", appendText(n.chiefComplaint, c))} />
          <div className="relative mt-2">
            <Input value={n.chiefComplaint} onChange={(e) => set("chiefComplaint", e.target.value)} placeholder="Fever for 3 days with body ache" className="pr-28" />
            <MicButton className="absolute top-1/2 right-1.5 -translate-y-1/2" onText={(t) => set("chiefComplaint", appendText(n.chiefComplaint, t))} />
          </div>
          <FieldWithMic label="History" value={n.history} onChange={(v) => set("history", v)} placeholder="Onset, duration, associated symptoms, past history…" rows={2} />
        </Section>

        <Section icon={ListChecks} title="Examination">
          <QuickRow items={EXAM_FINDINGS} onPick={(c) => set("examination", appendText(n.examination, c))} />
          <FieldWithMic value={n.examination} onChange={(v) => set("examination", v)} placeholder="Findings" rows={2} />
        </Section>

        <Section icon={FileCheck2} title="Diagnosis" required>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Autocomplete<Icd>
              className="flex-1"
              value={n.diagnosis}
              onChange={(v) => {
                set("diagnosis", v);
                if (n.icdCode) set("icdCode", "");
              }}
              onPick={(i) => {
                setN((s) => ({ ...s, diagnosis: i.title, icdCode: i.code }));
                setDirty(true);
              }}
              search={searchIcdCb}
              placeholder="Type a diagnosis or ICD-10 code — e.g. viral fever, J06"
              ariaLabel="Diagnosis"
              invalid={!!error && !n.diagnosis.trim()}
              render={(i) => (
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs font-semibold text-brand-700">{i.code}</span>
                  <span className="truncate">{i.title}</span>
                </div>
              )}
            />
            {n.icdCode ? (
              <span className="inline-flex items-center gap-1 self-start rounded-lg bg-brand-50 px-2.5 py-2 font-mono text-xs font-semibold text-brand-800 ring-1 ring-brand-200 sm:self-auto">
                ICD-10 {n.icdCode}
                <button type="button" onClick={() => set("icdCode", "")} aria-label="Remove ICD code" className="text-brand-400 hover:text-brand-700">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              n.diagnosis.trim().length > 2 && <span className="text-[11px] text-slate-400">Free text — pick a suggestion to add the ICD-10 code</span>
            )}
          </div>
        </Section>

        {/* Prescription */}
        <Section
          icon={Pill}
          title="Prescription ℞"
          action={
            lastRx && lastRx.items.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows((rs) => {
                    const kept = rs.filter((r) => r.medicine.trim());
                    const have = new Set(kept.map((r) => r.medicine.toLowerCase()));
                    return [...kept, ...lastRx.items.filter((i) => !have.has(i.medicine.toLowerCase())).map((i) => ({ ...i, key: keyRef.current++ }))];
                  });
                  setDirty(true);
                  toast({ tone: "info", title: "Last prescription copied", body: `From ${lastRx.date}` });
                }}
              >
                <Repeat2 className="h-3.5 w-3.5" /> Repeat last Rx
              </Button>
            ) : undefined
          }
        >
          {patient.allergies && (
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Allergic to {patient.allergies} — conflicting medicines are flagged.
            </p>
          )}
          <datalist id="rx-freq">{FREQUENCIES.map((f) => <option key={f} value={f} />)}</datalist>
          <datalist id="rx-dur">{DURATIONS.map((f) => <option key={f} value={f} />)}</datalist>
          <datalist id="rx-ins">{INSTRUCTIONS.map((f) => <option key={f} value={f} />)}</datalist>
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const conflict = conflicts.get(r.key);
              return (
                <div key={r.key} className={cn("rounded-xl p-2 ring-1", conflict ? "bg-rose-50 ring-rose-300" : "bg-brand-50/40 ring-brand-100")}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2.2fr_1fr_1fr_1fr_1.3fr_auto]">
                    <Autocomplete<DrugDefault>
                      className="col-span-2 sm:col-span-1"
                      value={r.medicine}
                      onChange={(v) => setRow(r.key, { medicine: v })}
                      onPick={(d) =>
                        setRow(r.key, {
                          medicine: d.medicine,
                          dosage: d.dosage ?? r.dosage,
                          frequency: d.frequency ?? r.frequency,
                          duration: d.duration ?? r.duration,
                          instructions: d.instructions ?? r.instructions,
                        })
                      }
                      search={searchDrugCb}
                      placeholder={idx === 0 ? "Medicine — type 2 letters" : "Medicine"}
                      ariaLabel="Medicine"
                      invalid={!!conflict}
                      icon={<Pill className="h-4 w-4 text-brand-400" />}
                      render={(d) => (
                        <div>
                          <div className="font-medium">{d.medicine}</div>
                          <div className="text-xs text-slate-500">{[d.dosage, d.frequency, d.duration, d.instructions].filter(Boolean).join(" · ")}</div>
                        </div>
                      )}
                    />
                    <Input value={r.dosage ?? ""} onChange={(e) => setRow(r.key, { dosage: e.target.value })} placeholder="Dose" aria-label="Dose" />
                    <Input value={r.frequency ?? ""} onChange={(e) => setRow(r.key, { frequency: e.target.value })} placeholder="1-0-1" list="rx-freq" aria-label="Frequency" />
                    <Input value={r.duration ?? ""} onChange={(e) => setRow(r.key, { duration: e.target.value })} placeholder="5 days" list="rx-dur" aria-label="Duration" />
                    <Input value={r.instructions ?? ""} onChange={(e) => setRow(r.key, { instructions: e.target.value })} placeholder="After food" list="rx-ins" aria-label="Instructions" />
                    <button
                      type="button"
                      onClick={() => {
                        setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow(keyRef.current++)]));
                        setDirty(true);
                      }}
                      className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove medicine"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {conflict && (
                    <p role="alert" className="mt-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Possible allergy: patient is allergic to “{conflict}”.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => addRow()}>
              <Plus className="h-3.5 w-3.5" /> Add medicine
            </Button>
            {favourites.slice(0, 6).map((f) => (
              <Chip key={f.medicine} onClick={() => addRow(f)} title="One of your most prescribed">
                + {f.medicine.length > 26 ? `${f.medicine.slice(0, 24)}…` : f.medicine}
              </Chip>
            ))}
          </div>
        </Section>

        <Section icon={MessageCircle} title="Advice">
          <QuickRow items={ADVICE} onPick={(c) => set("advice", appendText(n.advice, c, "; "))} />
          <FieldWithMic value={n.advice} onChange={(v) => set("advice", v)} placeholder="Diet, rest, warning signs" rows={2} />
        </Section>

        <Section icon={CalendarClock} title="Follow-up">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={!n.followUpDate} onClick={() => set("followUpDate", "")}>
              None
            </Chip>
            {FOLLOW_UPS.map((f) => (
              <Chip key={f.label} active={n.followUpDate === addDays(f.days)} onClick={() => set("followUpDate", addDays(f.days))}>
                {f.label}
              </Chip>
            ))}
            <Input type="date" value={n.followUpDate} min={addDays(1)} onChange={(e) => set("followUpDate", e.target.value)} className="h-8 w-40 text-xs" aria-label="Follow-up date" />
            {n.followUpDate && <span className="text-xs text-slate-500">{fmtDate(n.followUpDate)} — appears on the Follow-ups list</span>}
          </div>
        </Section>

        {/* Actions */}
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 shadow-brand-900/5 ring-brand-900/10 backdrop-blur">
          <Button variant="secondary" onClick={() => saveDraft()} disabled={pending}>
            Save draft <Kbd className="ml-1 hidden sm:inline-flex">Ctrl S</Kbd>
          </Button>
          <span className="text-xs text-slate-400">{dirty ? "Unsaved changes · auto-saves" : savedAt ? `Saved ${savedAt}` : "No changes"}</span>
          <Button
            size="lg"
            className="ml-auto"
            disabled={pending}
            onClick={() => {
              if (!n.diagnosis.trim()) return setError("Add a diagnosis before finalizing.");
              setError(null);
              setConfirming(true);
            }}
          >
            <Check className="h-4 w-4" /> Finalize & sign <Kbd className="ml-1 hidden border-white/30 bg-white/10 text-white sm:inline-flex">Ctrl ↵</Kbd>
          </Button>
        </div>
      </div>

      {/* Live summary + context */}
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-900/[0.06]">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Clinical summary
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(summary);
                toast({ tone: "info", title: "Summary copied" });
              }}
              className="text-slate-400 hover:text-brand-700"
              title="Copy"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-700">{summary}</p>
          <p className="mt-2 text-[10px] text-slate-400">Written automatically from what you enter. Updates as you type.</p>
        </div>
        {labs && (
          <a href={labs.href} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-900/[0.06] hover:ring-violet-300">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <FlaskConical className="h-3.5 w-3.5 text-violet-500" /> Labs{labs.date ? ` · ${labs.date}` : ""}
            </span>
            {labs.headline && <p className="text-[13px] leading-snug font-medium text-slate-800">{labs.headline}</p>}
            {labs.abnormal.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {labs.abnormal.slice(0, 8).map((a) => (
                  <li key={a.test} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{a.test}</span>
                    <span className={cn("tabular shrink-0 font-semibold", a.flag.startsWith("critical") ? "text-rose-700" : "text-amber-700")}>
                      {a.value} {a.unit} {a.flag.includes("low") ? "↓" : a.flag.includes("high") ? "↑" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">Latest results within range</p>
            )}
            <span className="mt-2 block text-[11px] font-medium text-violet-700">Open reports →</span>
          </a>
        )}
        {lastRx && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-900/[0.06]">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <History className="h-3.5 w-3.5" /> Last visit · {lastRx.date}
            </span>
            {lastRx.diagnosis && <p className="text-sm font-medium text-slate-800">{lastRx.diagnosis}</p>}
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {lastRx.items.map((i, k) => (
                <li key={k}>• {[i.medicine, i.frequency, i.duration].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/30 p-4 backdrop-blur-[2px]" onMouseDown={() => setConfirming(false)}>
          <div role="dialog" aria-label="Finalize prescription" className="dialog-in w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Finalize prescription?</h2>
            <p className="mt-1 text-sm text-slate-500">The PDF is generated and the visit is locked. Later corrections are added as an addendum.</p>
            {anyConflict && (
              <Banner tone="danger" icon={AlertTriangle} className="mt-4">
                One or more medicines may conflict with the patient&apos;s allergies. Double-check before signing.
              </Banner>
            )}
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">{summary}</div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={sendRx} onChange={(e) => setSendRx(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Send the prescription to the patient on WhatsApp (+{patient.waPhone})
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button onClick={finalize} disabled={pending} autoFocus>
                {pending ? "Finalizing…" : "Finalize & sign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  required,
  action,
  children,
}: {
  icon: typeof Pill;
  title: string;
  required?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-900/[0.06] sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function QuickRow({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div className="scrollbar-slim -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {items.map((c) => (
        <Chip key={c} onClick={() => onPick(c)} className="shrink-0">
          + {c}
        </Chip>
      ))}
    </div>
  );
}

function FieldWithMic({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        {label ? <span className="text-xs font-medium text-slate-700">{label}</span> : <span />}
        <MicButton onText={(t) => onChange(appendText(value, t, ". "))} />
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
    </div>
  );
}

function SaveTemplate({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, shared: boolean) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="step-in flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-violet-200">
      <label className="min-w-48 flex-1">
        <span className="mb-1 block text-xs font-medium text-slate-700">Template name</span>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Viral fever — adult" />
      </label>
      <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Share with all doctors
      </label>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const e = await onSave(name, shared);
          setBusy(false);
          setErr(e);
        }}
      >
        Save template
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      {err && <p className="w-full text-xs text-red-600">{err}</p>}
    </div>
  );
}
