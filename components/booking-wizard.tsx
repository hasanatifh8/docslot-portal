"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CalendarCheck2, CalendarDays, Clock, MessageCircle, Stethoscope, UserRound } from "@/components/icons";
import { bookAppointment } from "@/app/actions/appointments";
import { Banner, Button, Card, Chip, Field, Input, buttonClass, cn } from "@/components/ui";
import { WizardFooter, WizardSteps } from "@/components/wizard";
import { PatientPicker, type PickedPatient } from "@/components/patient-picker";
import { useToast } from "@/components/toast";

export type BookingDoctor = {
  id: string;
  name: string;
  specialty: string;
  department: string | null;
  room: string | null;
  slotMinutes: number;
};

type Day = { date: string; free: number };
type Slot = { start: string; end: string; label: string; taken: boolean; past: boolean };

const STEPS = ["Patient", "Doctor", "Date & time", "Confirm"];
const NOTES = ["Follow-up", "New complaint", "Report review", "Routine check-up"];

function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    dow: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    day: d.getUTCDate(),
    mon: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  };
}
function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function BookingWizard({
  doctors,
  todayStr,
  initialPatient,
  initialDoctorId,
  reschedule,
}: {
  doctors: BookingDoctor[];
  todayStr: string;
  initialPatient?: PickedPatient | null;
  initialDoctorId?: string | null;
  reschedule?: { id: string; when: string } | null;
}) {
  const toast = useToast();
  const [patient, setPatient] = useState<PickedPatient | null>(initialPatient ?? null);
  // Smart default: the patient's last doctor.
  const [doctorId, setDoctorId] = useState<string | null>(
    () => initialDoctorId ?? (initialPatient?.lastDoctorId && doctors.some((d) => d.id === initialPatient.lastDoctorId) ? initialPatient.lastDoctorId : null)
  );
  const [step, setStep] = useState(() => (initialPatient ? (initialDoctorId ? 2 : 1) : 0));
  const [dept, setDept] = useState<string>("all");
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [booked, setBooked] = useState<{ id: string; message?: string } | null>(null);

  const doctor = doctors.find((d) => d.id === doctorId) ?? null;
  const departments = useMemo(() => [...new Set(doctors.map((d) => d.department).filter(Boolean))] as string[], [doctors]);
  const exclude = reschedule ? `&exclude=${reschedule.id}` : "";

  const chooseDoctor = (id: string) => {
    if (id === doctorId) return;
    setDoctorId(id);
    setDays(null);
    setDate(null);
    setSlots(null);
    setSlot(null);
  };
  const chooseDate = (d: string) => {
    if (d === date) return;
    setDate(d);
    setSlots(null);
    setSlot(null);
  };
  const pickPatient = (p: PickedPatient | null) => {
    setPatient(p);
    if (p && !doctorId && p.lastDoctorId && doctors.some((d) => d.id === p.lastDoctorId)) chooseDoctor(p.lastDoctorId);
  };

  useEffect(() => {
    if (!doctorId) return;
    fetch(`/api/doctors/${doctorId}/availability?${exclude.slice(1)}`)
      .then((r) => r.json())
      .then((d) => {
        setDays(d.days ?? []);
        const first = (d.days as Day[] | undefined)?.find((x) => x.free > 0);
        if (first) setDate(first.date); // smart default: earliest day with room
      })
      .catch(() => setDays([]));
  }, [doctorId, exclude]);

  useEffect(() => {
    if (!doctorId || !date) return;
    fetch(`/api/doctors/${doctorId}/availability?date=${date}${exclude}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]));
  }, [doctorId, date, exclude]);

  const groups = useMemo(() => {
    const out: { label: string; slots: Slot[] }[] = [
      { label: "Morning", slots: [] },
      { label: "Afternoon", slots: [] },
      { label: "Evening", slots: [] },
    ];
    for (const s of slots ?? []) {
      if (s.past) continue;
      const h = Number(s.label.slice(0, 2));
      out[h < 12 ? 0 : h < 17 ? 1 : 2].slots.push(s);
    }
    return out.filter((g) => g.slots.length);
  }, [slots]);

  const canNext = [!!patient, !!doctor, !!slot, true][step];

  function submit() {
    if (!patient || !doctor || !slot) return;
    setError(null);
    start(async () => {
      const res = await bookAppointment({
        patientId: patient.id,
        doctorId: doctor.id,
        start: slot.start,
        note,
        notify,
        rescheduleOf: reschedule?.id,
      });
      if (res.error || !res.appointmentId) {
        setError(res.error ?? "Couldn't book.");
        if (res.error?.includes("taken")) {
          setStep(2);
          setSlot(null);
          fetch(`/api/doctors/${doctor.id}/availability?date=${date}${exclude}`)
            .then((r) => r.json())
            .then((d) => setSlots(d.slots ?? []));
        }
        return;
      }
      toast({ tone: "success", title: reschedule ? "Appointment rescheduled" : "Appointment booked", body: res.message });
      setBooked({ id: res.appointmentId, message: res.message });
    });
  }

  if (booked && patient && doctor && slot && date) {
    const p = dayParts(date);
    return (
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="bg-crosses relative bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <CalendarCheck2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-brand-100">{reschedule ? "Rescheduled" : "Booked"}</p>
          <h2 className="mt-1 text-2xl font-bold">
            {p.dow}, {p.day} {p.mon} · {to12h(slot.label)}
          </h2>
          <p className="mt-1 text-brand-100">
            {patient.name} with {doctor.name}
            {doctor.room && ` · Room ${doctor.room}`}
          </p>
          {booked.message && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> {booked.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
          {date === todayStr && (
            <Link href={`/opd`} className={buttonClass("primary", "md", "w-full")}>
              Go to OPD queue
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setBooked(null);
              setPatient(null);
              setSlot(null);
              setNote("");
              setStep(0);
            }}
            className={buttonClass("secondary", "md", "w-full")}
          >
            Book another
          </button>
          <Link href={`/appointments?date=${date}`} className={buttonClass("ghost", "md", "w-full")}>
            View day
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <div className="p-5 sm:p-6">
        {reschedule && (
          <Banner tone="info" icon={CalendarDays} className="mb-5">
            Rescheduling the appointment on <strong>{reschedule.when}</strong>. It is cancelled only once the new slot is booked.
          </Banner>
        )}
        <WizardSteps steps={STEPS} current={step} onJump={setStep} />
        {error && (
          <Banner tone="danger" icon={AlertTriangle} className="mb-4">
            {error}
          </Banner>
        )}

        <div key={step} className="step-in">
          {step === 0 && (
            <section className="space-y-3">
              <SectionTitle icon={UserRound} title="Who is the appointment for?" />
              <PatientPicker
                autoFocus
                value={patient}
                onChange={(p) => {
                  pickPatient(p);
                  if (p) setStep(1);
                }}
              />
            </section>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <SectionTitle icon={Stethoscope} title="Which doctor?" />
              {departments.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={dept === "all"} onClick={() => setDept("all")}>
                    All departments
                  </Chip>
                  {departments.map((d) => (
                    <Chip key={d} active={dept === d} onClick={() => setDept(d)}>
                      {d}
                    </Chip>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {doctors
                  .filter((d) => dept === "all" || d.department === dept)
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        chooseDoctor(d.id);
                        setStep(2);
                      }}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
                        doctorId === d.id ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-slate-200 hover:ring-brand-300"
                      )}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{d.name}</div>
                        <div className="truncate text-xs text-slate-500">{d.specialty}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-400">
                          {d.department && <span>{d.department}</span>}
                          {d.room && <span>· Room {d.room}</span>}
                          <span>· {d.slotMinutes} min</span>
                        </div>
                        {patient?.lastDoctorId === d.id && (
                          <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Seen last time</span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          )}

          {step === 2 && doctor && (
            <section className="space-y-5">
              <SectionTitle icon={CalendarDays} title={`Pick a day with ${doctor.name}`} />
              {days === null ? (
                <div className="flex gap-2 overflow-hidden">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-20 w-16 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : days.length === 0 ? (
                <Banner tone="warn" icon={AlertTriangle}>
                  {doctor.name} has no working days in the next two weeks. Check working hours or leave on the Doctors page.
                </Banner>
              ) : (
                <div className="scrollbar-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d) => {
                    const p = dayParts(d.date);
                    const sel = d.date === date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        disabled={d.free === 0}
                        onClick={() => chooseDate(d.date)}
                        className={cn(
                          "flex w-[4.5rem] shrink-0 flex-col items-center rounded-2xl px-2 py-2.5 ring-1 transition-all",
                          sel ? "bg-brand-600 text-white shadow-md shadow-brand-700/25 ring-brand-600" : "bg-white ring-slate-200 hover:ring-brand-300",
                          d.free === 0 && "cursor-not-allowed opacity-40"
                        )}
                      >
                        <span className={cn("text-[11px] font-medium uppercase", sel ? "text-brand-100" : "text-slate-500")}>
                          {d.date === todayStr ? "Today" : p.dow}
                        </span>
                        <span className="text-xl leading-tight font-bold">{p.day}</span>
                        <span className={cn("text-[11px]", sel ? "text-brand-100" : "text-slate-400")}>{p.mon}</span>
                        <span
                          className={cn(
                            "mt-1 rounded-full px-1.5 text-[10px] font-semibold",
                            sel ? "bg-white/20" : d.free === 0 ? "bg-slate-100 text-slate-400" : d.free < 4 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {d.free === 0 ? "Full" : `${d.free} free`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {date && (
                <div className="space-y-4">
                  {slots === null ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                      ))}
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-slate-500">No free slots left on this day.</p>
                  ) : (
                    groups.map((g) => (
                      <div key={g.label}>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          <Clock className="h-3.5 w-3.5" /> {g.label}
                          <span className="font-normal normal-case text-slate-400">· {g.slots.filter((s) => !s.taken).length} free</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                          {g.slots.map((s) => (
                            <button
                              key={s.start}
                              type="button"
                              disabled={s.taken}
                              onClick={() => setSlot(s)}
                              title={s.taken ? "Already booked" : undefined}
                              className={cn(
                                "tabular h-10 rounded-xl text-sm font-medium ring-1 transition-all",
                                slot?.start === s.start
                                  ? "bg-brand-600 text-white shadow-md shadow-brand-700/25 ring-brand-600"
                                  : s.taken
                                    ? "cursor-not-allowed bg-slate-50 text-slate-300 line-through ring-slate-100"
                                    : "bg-white text-slate-700 ring-slate-200 hover:bg-brand-50 hover:ring-brand-300"
                              )}
                            >
                              {to12h(s.label)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          )}

          {step === 3 && patient && doctor && slot && date && (
            <section className="space-y-5">
              <SectionTitle icon={BadgeCheck} title="Confirm booking" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Summary label="Patient" value={patient.name ?? "—"} sub={[patient.uhid, `+${patient.waPhone}`].filter(Boolean).join(" · ")} onEdit={() => setStep(0)} />
                <Summary label="Doctor" value={doctor.name} sub={[doctor.specialty, doctor.room && `Room ${doctor.room}`].filter(Boolean).join(" · ")} onEdit={() => setStep(1)} />
                <Summary
                  label="When"
                  value={`${dayParts(date).dow}, ${dayParts(date).day} ${dayParts(date).mon}`}
                  sub={`${to12h(slot.label)} · ${doctor.slotMinutes} min`}
                  onEdit={() => setStep(2)}
                />
              </div>
              <Field label="Reason / note (optional)">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {NOTES.map((n) => (
                    <Chip key={n} active={note === n} onClick={() => setNote(note === n ? "" : n)}>
                      {n}
                    </Chip>
                  ))}
                </div>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the doctor should know" />
              </Field>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-emerald-50/60 px-4 py-3 ring-1 ring-emerald-600/15">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-900">
                  Send confirmation on WhatsApp to <strong>+{patient.waPhone}</strong> (reminders go automatically)
                </span>
              </label>
            </section>
          )}
        </div>

        <WizardFooter onBack={step > 0 ? () => setStep(step - 1) : undefined}>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Continue →
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={pending}>
              <CalendarCheck2 className="h-4 w-4" />
              {pending ? "Booking…" : reschedule ? "Confirm new time" : "Book appointment"}
            </Button>
          )}
        </WizardFooter>
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Clock; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

function Summary({ label, value, sub, onEdit }: { label: string; value: string; sub?: string; onEdit: () => void }) {
  return (
    <div className="rounded-2xl p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-brand-600 hover:text-brand-800">
          Change
        </button>
      </div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
