import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Droplet, FileText, Gauge, HeartPulse, History, Hourglass, IndianRupee, NotebookPen, Ruler, Scale, ShieldAlert, Siren, Sparkles, Stethoscope, Thermometer, Weight, Wind } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dateOnlyValue, fmt } from "@/lib/format";
import { ageFrom, patientMeta } from "@/lib/patients";
import { canTransition, type VisitStatus } from "@/lib/encounter";
import { FLAG_TEXT, bmi, bmiBand, clinicalSummary, flagVital, type VitalKey } from "@/lib/clinical";
import { rupees } from "@/lib/money";
import type { DrugDefault } from "@/lib/drugs";
import { cancelVisit, startConsultation, startTriage } from "@/app/actions/opd";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, buttonClass, cn } from "@/components/ui";
import { TriageForm } from "@/components/triage-form";
import { ConsultationWorkspace, type RxItem, type Template } from "@/components/consultation-workspace";
import { AddendumForm, SendRxButton } from "@/components/visit-actions";
import { AutoRefresh, VisitStatusBadge, VisitStepper } from "@/components/visit-status";
import { PatientAvatar } from "@/components/patient-avatar";

export default async function VisitPage({ params }: PageProps<"/opd/[id]">) {
  const user = await requirePermission("opd.view");
  const tz = user.clinic.timezone;
  const { id } = await params;

  const visit = await prisma.visit.findFirst({
    where: { id, clinicId: user.clinicId },
    omit: { prescriptionPdf: true },
    include: {
      patient: true,
      doctor: true,
      checkedInBy: { select: { name: true } },
      triageBy: { select: { name: true } },
      consultBy: { select: { name: true } },
      prescriptionItems: { orderBy: { sortOrder: "asc" } },
      addenda: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      invoice: { select: { id: true, number: true, status: true, total: true, paid: true } },
    },
  });
  if (!visit) notFound();

  const s = visit.status;
  const ownPatient = user.role !== "doctor" || user.doctorId === visit.doctorId;
  const mayTriage = can(user.role, "opd.triage");
  const mayConsult = can(user.role, "opd.consult") && ownPatient;
  const showTriageForm = s === "TRIAGE_IN_PROGRESS" && mayTriage;
  const showConsultForm = s === "IN_CONSULTATION" && mayConsult;
  const p = visit.patient;
  const age = ageFrom(p.dob);
  const t = (d: Date | null) => (d ? fmt(d, tz, "h:mm a") : undefined);

  const [previous, templates, favourites] = await Promise.all([
    prisma.visit.findMany({
      where: { patientId: visit.patientId, id: { not: visit.id }, status: "COMPLETED" },
      orderBy: { checkedInAt: "desc" },
      take: 6,
      omit: { prescriptionPdf: true },
      include: { doctor: true, prescriptionItems: { orderBy: { sortOrder: "asc" } } },
    }),
    showConsultForm
      ? prisma.consultTemplate.findMany({
          where: { clinicId: user.clinicId, OR: [{ doctorId: null }, { doctorId: visit.doctorId }] },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    showConsultForm ? doctorFavourites(visit.doctorId) : Promise.resolve([] as DrugDefault[]),
  ]);

  const vitals: Record<VitalKey, number | null> = {
    bpSystolic: visit.bpSystolic,
    bpDiastolic: visit.bpDiastolic,
    pulse: visit.pulse,
    spo2: visit.spo2,
    temperatureC: visit.temperatureC,
    respRate: visit.respRate,
    heightCm: visit.heightCm,
    weightKg: visit.weightKg,
  };
  const b = bmi(visit.heightCm, visit.weightKg);
  const tiles: { key?: VitalKey; label: string; icon: typeof Gauge; value: string | number | null; unit: string; flag?: ReturnType<typeof flagVital> }[] = [
    {
      label: "Blood pressure",
      icon: Gauge,
      value: visit.bpSystolic != null && visit.bpDiastolic != null ? `${visit.bpSystolic}/${visit.bpDiastolic}` : null,
      unit: "mmHg",
      flag: worst(flagVital("bpSystolic", visit.bpSystolic), flagVital("bpDiastolic", visit.bpDiastolic)),
    },
    { label: "Pulse", icon: HeartPulse, value: visit.pulse, unit: "bpm", flag: flagVital("pulse", visit.pulse) },
    { label: "SpO₂", icon: Droplet, value: visit.spo2, unit: "%", flag: flagVital("spo2", visit.spo2) },
    { label: "Temperature", icon: Thermometer, value: visit.temperatureC, unit: "°C", flag: flagVital("temperatureC", visit.temperatureC) },
    { label: "Resp. rate", icon: Wind, value: visit.respRate, unit: "/min", flag: flagVital("respRate", visit.respRate) },
    { label: "Height", icon: Ruler, value: visit.heightCm, unit: "cm" },
    { label: "Weight", icon: Weight, value: visit.weightKg, unit: "kg" },
    { label: "BMI", icon: Scale, value: b ? `${b}` : null, unit: b ? bmiBand(b) ?? "" : "" },
  ];
  const last = previous[0];
  const toRx = (i: RxItem) => ({ medicine: i.medicine, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions });

  return (
    <div className="space-y-5">
      {/* Live sync while someone else holds the visit; paused while you're editing. */}
      {!showTriageForm && !showConsultForm && s !== "COMPLETED" && s !== "CANCELLED" && <AutoRefresh />}

      {/* Patient banner */}
      <Card className="overflow-hidden">
        <div className={cn("h-1", visit.priority === "emergency" ? "bg-rose-500" : visit.priority === "priority" ? "bg-amber-400" : "bg-gradient-to-r from-brand-400 to-brand-600")} />
        <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-md",
              visit.priority === "emergency" ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-brand-500 to-brand-700"
            )}
          >
            <span className="text-[9px] font-semibold tracking-widest uppercase opacity-80">Token</span>
            <span className="tabular text-xl leading-none font-extrabold">{visit.token}</span>
          </div>
          <PatientAvatar name={p.name} gender={p.gender} className="hidden h-12 w-12 text-sm sm:flex" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{p.name || p.waPhone}</h1>
              {visit.priority !== "normal" && (
                <Badge tone={visit.priority === "emergency" ? "red" : "amber"} className="gap-1">
                  {visit.priority === "emergency" && <Siren className="h-3 w-3" />}
                  {visit.priority}
                </Badge>
              )}
              <Badge tone={visit.visitType === "follow_up" ? "green" : "brand"} className="normal-case">
                {visit.visitType === "follow_up" ? "Follow-up" : "New visit"}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {[p.uhid, patientMeta(p), p.bloodGroup, `+${p.waPhone}`].filter(Boolean).join(" · ")}
            </p>
            <p className="truncate text-xs text-slate-400">
              {visit.doctor.name}
              {visit.doctor.room && ` · Room ${visit.doctor.room}`} · {fmt(visit.checkedInAt, tz, "d MMM yyyy, h:mm a")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VisitStatusBadge status={s} />
            {visit.invoice && can(user.role, "billing.view") && (
              <Link
                href={`/billing/${visit.invoice.id}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1",
                  visit.invoice.status === "paid" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                )}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                {visit.invoice.status === "paid" ? "Paid" : `${rupees(visit.invoice.total - visit.invoice.paid)} due`}
              </Link>
            )}
            <Link href={`/patients/${p.id}`} className={buttonClass("secondary", "sm")}>
              Profile
            </Link>
            {can(user.role, "opd.checkin") && canTransition(s, "cancel") && (
              <form action={cancelVisit}>
                <input type="hidden" name="visitId" value={visit.id} />
                <Button variant="danger" size="sm">
                  Cancel visit
                </Button>
              </form>
            )}
          </div>
        </div>
        {(p.allergies || p.chronicConditions) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rose-100 bg-rose-50 px-5 py-2.5 text-sm text-rose-900">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            {p.allergies && (
              <span>
                <span className="font-semibold">Allergies:</span> {p.allergies}
              </span>
            )}
            {p.chronicConditions && (
              <span>
                <span className="font-semibold">Conditions:</span> {p.chronicConditions}
              </span>
            )}
          </div>
        )}
      </Card>

      <Card className="px-5 py-4">
        <VisitStepper
          status={s}
          times={{
            CHECKED_IN: t(visit.checkedInAt),
            TRIAGE_IN_PROGRESS: t(visit.triageStartedAt),
            TRIAGE_COMPLETED: t(visit.triageCompletedAt),
            IN_CONSULTATION: t(visit.consultStartedAt),
            COMPLETED: t(visit.completedAt),
          }}
        />
        <p className="mt-3 text-xs text-slate-500">
          {[
            visit.checkedInBy && `Checked in by ${visit.checkedInBy.name}`,
            visit.triageBy && `triage by ${visit.triageBy.name}`,
            visit.consultBy && `consultation by ${visit.consultBy.name}`,
            visit.cancelledAt && `cancelled at ${t(visit.cancelledAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Card>

      <NextStep status={s} visitId={visit.id} mayTriage={mayTriage} mayConsult={mayConsult} doctorName={visit.doctor.name} triager={visit.triageBy?.name} />

      {s === "COMPLETED" && visit.pdfGeneratedAt && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">Prescription (PDF)</div>
              <div className="text-xs text-slate-500">
                Signed {fmt(visit.pdfGeneratedAt, tz, "d MMM yyyy, h:mm a")}
                {visit.rxSentAt && ` · sent on WhatsApp ${fmt(visit.rxSentAt, tz, "h:mm a")}`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/visits/${visit.id}/prescription`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
              Open / print
            </a>
            <a href={`/api/visits/${visit.id}/prescription?download`} className={buttonClass("secondary", "sm")}>
              Download
            </a>
            <SendRxButton visitId={visit.id} sentAt={visit.rxSentAt ? fmt(visit.rxSentAt, tz, "d MMM, h:mm a") : null} />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle icon={HeartPulse}>Triage · vitals</CardTitle>
          {visit.triageCompletedAt && <span className="text-xs text-slate-400">recorded {t(visit.triageCompletedAt)}</span>}
        </CardHeader>
        <CardBody>
          {showTriageForm ? (
            <TriageForm visitId={visit.id} vitals={vitals} />
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map(({ label, icon: Icon, value, unit, flag }) => {
                const bad = flag === "critical" ? "critical" : flag === "low" || flag === "high" ? "warn" : null;
                return (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-3 rounded-xl p-3 ring-1",
                      bad === "critical" ? "bg-rose-50 ring-rose-300" : bad === "warn" ? "bg-amber-50 ring-amber-200" : "bg-canvas/70 ring-brand-900/[0.04]"
                    )}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bad === "critical" ? "bg-rose-500 text-white" : bad === "warn" ? "bg-amber-400 text-white" : "bg-white text-brand-600")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-[11px] text-slate-500">{label}</dt>
                      <dd className="tabular text-sm font-semibold text-slate-900">
                        {value ?? <span className="font-normal text-slate-400">—</span>}
                        {value != null && unit && <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>}
                        {flag && flag !== "ok" && flag !== "invalid" && (
                          <span className={cn("ml-1.5 text-[10px] font-bold uppercase", bad === "critical" ? "text-rose-600" : "text-amber-700")}>{FLAG_TEXT[flag]}</span>
                        )}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          )}
        </CardBody>
      </Card>

      {showConsultForm ? (
        <ConsultationWorkspace
          visitId={visit.id}
          initial={{
            chiefComplaint: visit.chiefComplaint ?? "",
            history: visit.history ?? "",
            examination: visit.examination ?? "",
            diagnosis: visit.diagnosis ?? "",
            icdCode: visit.icdCode ?? "",
            advice: visit.advice ?? "",
            followUpDate: dateOnlyValue(visit.followUpDate),
          }}
          initialItems={visit.prescriptionItems.map(toRx)}
          patient={{ name: p.name, age, gender: p.gender, allergies: p.allergies, chronicConditions: p.chronicConditions, waPhone: p.waPhone }}
          vitals={vitals}
          visitType={visit.visitType}
          templates={templates.map(
            (tpl): Template => ({
              id: tpl.id,
              name: tpl.name,
              mine: tpl.createdById === user.id || user.role === "admin",
              shared: tpl.doctorId == null,
              chiefComplaint: tpl.chiefComplaint,
              examination: tpl.examination,
              diagnosis: tpl.diagnosis,
              icdCode: tpl.icdCode,
              advice: tpl.advice,
              items: (Array.isArray(tpl.items) ? tpl.items : []) as RxItem[],
            })
          )}
          favourites={favourites}
          lastRx={last ? { date: fmt(last.checkedInAt, tz, "d MMM yyyy"), diagnosis: last.diagnosis, items: last.prescriptionItems.map(toRx) } : null}
        />
      ) : (
        (["IN_CONSULTATION", "COMPLETED"].includes(s) || visit.diagnosis) && (
          <Card>
            <CardHeader>
              <CardTitle icon={Stethoscope}>Consultation</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              {s === "COMPLETED" && (
                <div className="rounded-xl bg-violet-50/60 p-4 ring-1 ring-violet-200/60">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet-800 uppercase">
                    <Sparkles className="h-3.5 w-3.5" /> Clinical summary
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {clinicalSummary({
                      patient: { name: p.name, age, gender: p.gender, allergies: p.allergies, chronicConditions: p.chronicConditions },
                      visitType: visit.visitType,
                      vitals,
                      chiefComplaint: visit.chiefComplaint,
                      history: visit.history,
                      examination: visit.examination,
                      diagnosis: visit.diagnosis,
                      icdCode: visit.icdCode,
                      items: visit.prescriptionItems,
                      advice: visit.advice,
                      followUp: visit.followUpDate ? fmt(visit.followUpDate, "UTC", "d MMM yyyy") : null,
                    })}
                  </p>
                </div>
              )}
              <ConsultationSummary visit={visit} />
              {(visit.addenda.length > 0 || (s === "COMPLETED" && mayConsult)) && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <NotebookPen className="h-3.5 w-3.5" /> Addenda
                  </div>
                  {visit.addenda.map((a) => (
                    <div key={a.id} className="rounded-xl bg-amber-50/60 p-3 text-sm ring-1 ring-amber-200/70">
                      <p className="whitespace-pre-wrap text-slate-800">{a.text}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {a.author?.name ?? "Unknown"} · {fmt(a.createdAt, tz, "d MMM yyyy, h:mm a")}
                      </p>
                    </div>
                  ))}
                  {s === "COMPLETED" && mayConsult && <AddendumForm visitId={visit.id} />}
                </div>
              )}
            </CardBody>
          </Card>
        )
      )}

      {previous.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle icon={History}>Previous visits</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {previous.map((v) => (
              <li key={v.id}>
                <Link href={`/opd/${v.id}`} className="block px-4 py-3 text-sm hover:bg-brand-50/50 sm:px-5">
                  <div>
                    <span className="font-medium text-slate-900">{fmt(v.checkedInAt, tz, "d MMM yyyy")}</span>
                    <span className="text-slate-500">
                      {" "}
                      · {v.doctor.name} · {v.diagnosis || "No diagnosis recorded"}
                      {v.icdCode && ` [${v.icdCode}]`}
                    </span>
                  </div>
                  {v.prescriptionItems.length > 0 && (
                    <div className="mt-0.5 truncate text-xs text-slate-400">℞ {v.prescriptionItems.map((i) => i.medicine).join(", ")}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function worst(...flags: ReturnType<typeof flagVital>[]) {
  if (flags.includes("critical")) return "critical" as const;
  if (flags.includes("high")) return "high" as const;
  if (flags.includes("low")) return "low" as const;
  return flags.includes("ok") ? ("ok" as const) : null;
}

/** The doctor's most-prescribed lines, with the dose they last used. */
async function doctorFavourites(doctorId: string): Promise<DrugDefault[]> {
  const top = await prisma.prescriptionItem.groupBy({
    by: ["medicine"],
    where: { visit: { doctorId, status: "COMPLETED" } },
    _count: { medicine: true },
    orderBy: { _count: { medicine: "desc" } },
    take: 10,
  });
  if (!top.length) return [];
  const rows = await prisma.prescriptionItem.findMany({
    where: { medicine: { in: top.map((t) => t.medicine) }, visit: { doctorId } },
    orderBy: { visit: { checkedInAt: "desc" } },
  });
  return top.map((t) => {
    const r = rows.find((x) => x.medicine === t.medicine);
    return {
      medicine: t.medicine,
      dosage: r?.dosage ?? undefined,
      frequency: r?.frequency ?? undefined,
      duration: r?.duration ?? undefined,
      instructions: r?.instructions ?? undefined,
    };
  });
}

/** The single call-to-action for whoever is looking at the visit right now. */
function NextStep({
  status,
  visitId,
  mayTriage,
  mayConsult,
  doctorName,
  triager,
}: {
  status: VisitStatus;
  visitId: string;
  mayTriage: boolean;
  mayConsult: boolean;
  doctorName: string;
  triager?: string;
}) {
  const action = (label: string, fn: (fd: FormData) => Promise<void>, hint: string) => (
    <Card className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-brand-50 to-white px-5 py-4 ring-brand-200">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
          <Activity className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium text-brand-900">{hint}</p>
      </div>
      <form action={fn}>
        <input type="hidden" name="visitId" value={visitId} />
        <Button size="lg" autoFocus>
          {label}
        </Button>
      </form>
    </Card>
  );
  const waiting = (msg: string) => (
    <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50/70 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-600/15 ring-inset">
      <Hourglass className="h-4 w-4 animate-pulse text-amber-500" />
      {msg}
    </div>
  );

  switch (status) {
    case "CHECKED_IN":
      return mayTriage ? action("Start triage", startTriage, "Patient has arrived. Open triage to capture vitals.") : waiting("Waiting for triage.");
    case "TRIAGE_IN_PROGRESS":
      return mayTriage ? null : waiting(`Triage in progress${triager ? ` with ${triager}` : ""}.`);
    case "TRIAGE_COMPLETED":
      return mayConsult ? action("Start consultation", startConsultation, "Triage done. Patient is ready for you.") : waiting(`Triage done — waiting for ${doctorName}.`);
    case "IN_CONSULTATION":
      return mayConsult ? null : waiting(`With ${doctorName}.`);
    default:
      return null;
  }
}

function ConsultationSummary({
  visit,
}: {
  visit: {
    chiefComplaint: string | null;
    history: string | null;
    examination: string | null;
    diagnosis: string | null;
    icdCode: string | null;
    advice: string | null;
    followUpDate: Date | null;
    prescriptionItems: { id: string; medicine: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
  };
}) {
  const rows: [string, string | null][] = [
    ["Chief complaint", visit.chiefComplaint],
    ["History", visit.history],
    ["Examination", visit.examination],
    ["Diagnosis", visit.diagnosis ? `${visit.diagnosis}${visit.icdCode ? ` (ICD-10 ${visit.icdCode})` : ""}` : null],
    ["Advice", visit.advice],
    ["Follow-up", visit.followUpDate ? fmt(visit.followUpDate, "UTC", "d MMM yyyy") : null],
  ];
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="whitespace-pre-wrap text-slate-900">{v || <span className="text-slate-400">—</span>}</dd>
          </div>
        ))}
      </dl>
      {visit.prescriptionItems.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-slate-500">Prescription</div>
          <ol className="list-decimal space-y-1 pl-5">
            {visit.prescriptionItems.map((i) => (
              <li key={i.id}>
                <span className="font-medium">{i.medicine}</span>{" "}
                <span className="text-slate-600">{[i.dosage, i.frequency, i.duration, i.instructions].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
