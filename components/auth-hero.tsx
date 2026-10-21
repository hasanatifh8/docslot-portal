import { CalendarHeart, HeartPulse, Pill, ShieldPlus, Stethoscope } from "lucide-react";
import { EcgLine } from "@/components/ui";

const features = [
  { icon: Stethoscope, title: "OPD in one flow", text: "Check-in, triage, consultation and prescription — no paper." },
  { icon: HeartPulse, title: "Vitals at a glance", text: "Triage captures BP, pulse, SpO₂ and temperature for the doctor." },
  { icon: Pill, title: "Clean prescriptions", text: "Finalized as a signed PDF the moment the visit closes." },
  { icon: CalendarHeart, title: "WhatsApp booking", text: "Patients book, reschedule and get reminders in chat." },
];

export function AuthHero() {
  return (
    <>
      <div className="relative flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
          <ShieldPlus className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-brand-50">DocSlot HMS</span>
      </div>

      <div className="relative">
        <h2 className="max-w-sm text-3xl leading-tight font-semibold tracking-tight">
          Calmer clinics.
          <br />
          <span className="text-brand-200">Better care.</span>
        </h2>
        <EcgLine animated className="mt-5 h-10 w-full max-w-md text-accent-500" />
        <ul className="mt-8 space-y-5">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon className="h-5 w-5 text-brand-100" />
              </div>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-sm text-brand-100/80">{text}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-brand-100/60">Built for hospitals and clinics · by Cliccx</p>
    </>
  );
}
