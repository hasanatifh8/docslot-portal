"use client";

import { useActionState, useMemo, useState } from "react";
import { Activity, AlertTriangle, Droplet, Gauge, HeartPulse, Ruler, Scale, Thermometer, Weight, Wind } from "lucide-react";
import { saveVitals, type OpdFormState } from "@/app/actions/opd";
import { Banner, Button, FormMessage, Kbd, cn } from "@/components/ui";
import { useActionToast } from "@/components/toast";
import { FLAG_TEXT, VITAL_RANGES, bmi, bmiBand, flagVital, type VitalKey } from "@/lib/clinical";

type Vitals = Record<VitalKey, number | null>;

const FIELDS: { key: VitalKey; icon: typeof Gauge; placeholder: string; decimal?: boolean; required?: boolean }[] = [
  { key: "bpSystolic", icon: Gauge, placeholder: "120", required: true },
  { key: "bpDiastolic", icon: Gauge, placeholder: "80", required: true },
  { key: "pulse", icon: HeartPulse, placeholder: "72", required: true },
  { key: "spo2", icon: Droplet, placeholder: "98", required: true },
  { key: "temperatureC", icon: Thermometer, placeholder: "36.8", decimal: true, required: true },
  { key: "respRate", icon: Wind, placeholder: "16" },
  { key: "heightCm", icon: Ruler, placeholder: "170", decimal: true },
  { key: "weightKg", icon: Weight, placeholder: "68", decimal: true },
];

const flagStyle = {
  ok: "border-emerald-300 bg-emerald-50/40",
  low: "border-amber-400 bg-amber-50/60",
  high: "border-amber-400 bg-amber-50/60",
  critical: "border-rose-500 bg-rose-50 alert-pulse",
  invalid: "border-red-500 bg-red-50",
};

/**
 * Triage with live validation: impossible values are blocked, abnormal ones
 * flagged amber, critical ones red — before the patient reaches the doctor.
 */
export function TriageForm({ visitId, vitals }: { visitId: string; vitals: Vitals }) {
  const [state, action, pending] = useActionState<OpdFormState, FormData>(saveVitals, {});
  const [v, setV] = useState<Record<VitalKey, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, vitals[f.key] == null ? "" : String(vitals[f.key])])) as Record<VitalKey, string>
  );
  useActionToast(state, "Vitals saved");

  const num = (k: VitalKey) => (v[k].trim() === "" ? null : Number(v[k]));
  const flags = useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.key, flagVital(f.key, num(f.key))])) as Record<VitalKey, ReturnType<typeof flagVital>>, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const invalid = FIELDS.filter((f) => flags[f.key] === "invalid");
  const missing = FIELDS.filter((f) => f.required && num(f.key) == null);
  const bpHalf = (num("bpSystolic") == null) !== (num("bpDiastolic") == null);
  const critical = FIELDS.filter((f) => flags[f.key] === "critical");
  const b = bmi(num("heightCm"), num("weightKg"));
  const canComplete = !invalid.length && !missing.length && !bpHalf;

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <input type="hidden" name="visitId" value={visitId} />

      {critical.length > 0 && (
        <Banner tone="danger" icon={AlertTriangle} title="Critical reading — inform the doctor now">
          {critical.map((f) => `${VITAL_RANGES[f.key].label} ${v[f.key]} ${VITAL_RANGES[f.key].unit}`).join(" · ")}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map(({ key, icon: Icon, placeholder, decimal, required }) => {
          const r = VITAL_RANGES[key];
          const flag = flags[key];
          return (
            <label key={key} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Icon className="h-3.5 w-3.5 text-brand-500" />
                {r.label}
                {required && <span className="text-rose-500">*</span>}
              </span>
              <div className={cn("flex items-center rounded-xl border bg-white pr-2 transition focus-within:ring-2 focus-within:ring-brand-500/20", flag ? flagStyle[flag] : "border-slate-300")}>
                <input
                  name={key}
                  value={v[key]}
                  onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, "") }))}
                  inputMode={decimal ? "decimal" : "numeric"}
                  placeholder={placeholder}
                  aria-invalid={flag === "invalid"}
                  className="tabular h-11 w-full min-w-0 bg-transparent px-3 text-lg font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300"
                />
                <span className="shrink-0 text-xs text-slate-400">{r.unit}</span>
              </div>
              <span
                className={cn(
                  "mt-1 block h-4 text-[11px] font-medium",
                  flag === "invalid" ? "text-red-600" : flag === "critical" ? "text-rose-600" : flag === "low" || flag === "high" ? "text-amber-700" : "text-emerald-600"
                )}
              >
                {flag === "invalid"
                  ? `Check value (${r.min}–${r.max})`
                  : flag && flag !== "ok"
                    ? FLAG_TEXT[flag]
                    : flag === "ok" && r.normal
                      ? "Normal"
                      : r.normal
                        ? `Normal ${r.normal[0]}–${r.normal[1]}`
                        : ""}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <Scale className="h-4 w-4 text-violet-500" />
        <span className="text-slate-600">BMI</span>
        <span className="tabular font-semibold text-slate-900">{b ?? "—"}</span>
        {b && <span className="text-xs text-slate-500">{bmiBand(b)}</span>}
        <Activity className="ml-auto h-4 w-4 text-slate-300" />
        <span className="text-xs text-slate-400">Auto-calculated from height & weight</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending || invalid.length > 0}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="complete" size="lg" disabled={pending || !canComplete}>
          {pending ? "Saving…" : "Complete triage → send to doctor"}
        </Button>
        <span className="text-xs text-slate-400">
          {invalid.length
            ? "Fix the values marked in red."
            : bpHalf
              ? "Enter both BP numbers."
              : missing.length
                ? `Still needed: ${missing.map((f) => VITAL_RANGES[f.key].label).join(", ")}`
                : (
                  <>
                    Ready — press <Kbd>Enter</Kbd> on the button
                  </>
                )}
        </span>
      </div>
    </form>
  );
}
