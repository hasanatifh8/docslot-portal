import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ClipboardPlus,
  Download,
  Droplet,
  FileText,
  Gauge,
  HeartPulse,
  History,
  Hourglass,
  Ruler,
  Scale,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  Weight,
  Wind,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dateOnlyValue, fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";
import { canTransition, type VisitStatus } from "@/lib/encounter";
import { cancelVisit, startConsultation, startTriage } from "@/app/actions/opd";
import { Button, Card, CardBody, CardHeader, CardTitle, PageHeader, buttonClass } from "@/components/ui";
import { ConsultationForm, VitalsForm } from "@/components/visit-forms";
import { AutoRefresh, VisitStatusBadge, VisitStepper } from "@/components/visit-status";

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
    },
  });
  if (!visit) notFound();

  const previous = await prisma.visit.findMany({
    where: { patientId: visit.patientId, id: { not: visit.id }, status: "COMPLETED" },
    orderBy: { checkedInAt: "desc" },
    take: 5,
    include: { doctor: true },
  });

  const s = visit.status;
  const ownPatient = user.role !== "doctor" || user.doctorId === visit.doctorId;
  const mayTriage = can(user.role, "opd.triage");
  const mayConsult = can(user.role, "opd.consult") && ownPatient;
  const showTriageForm = s === "TRIAGE_IN_PROGRESS" && mayTriage;
  const showConsultForm = s === "IN_CONSULTATION" && mayConsult;
  const p = visit.patient;
  const t = (d: Date | null) => (d ? fmt(d, tz, "h:mm a") : undefined);

  const bmi = visit.heightCm && visit.weightKg ? (visit.weightKg / (visit.heightCm / 100) ** 2).toFixed(1) : null;
  const vitals: VitalTile[] = [
    { label: "Blood pressure", icon: Gauge, tone: "text-rose-500 bg-rose-50", value: visit.bpSystolic != null && visit.bpDiastolic != null ? `${visit.bpSystolic}/${visit.bpDiastolic}` : null, unit: "mmHg" },
    { label: "Pulse", icon: HeartPulse, tone: "text-rose-500 bg-rose-50", value: visit.pulse, unit: "bpm" },
    { label: "SpO₂", icon: Droplet, tone: "text-sky-600 bg-sky-50", value: visit.spo2, unit: "%" },
    { label: "Temperature", icon: Thermometer, tone: "text-amber-600 bg-amber-50", value: visit.temperatureC, unit: "°C" },
    { label: "Resp. rate", icon: Wind, tone: "text-sky-600 bg-sky-50", value: visit.respRate, unit: "/min" },
    { label: "Height", icon: Ruler, tone: "text-brand-600 bg-brand-50", value: visit.heightCm, unit: "cm" },
    { label: "Weight", icon: Weight, tone: "text-brand-600 bg-brand-50", value: visit.weightKg, unit: "kg" },
    { label: "BMI", icon: Scale, tone: "text-violet-600 bg-violet-50", value: bmi, unit: "" },
  ];

  return (
    <div className="space-y-6">
      {/* Live sync while someone else holds the visit; paused while you're editing. */}
      {!showTriageForm && !showConsultForm && s !== "COMPLETED" && s !== "CANCELLED" && <AutoRefresh />}

      <PageHeader
        icon={ClipboardPlus}
        title={`Token #${visit.token} · ${p.name || p.waPhone}`}
        description={[p.uhid, patientMeta(p), visit.doctor.name, fmt(visit.checkedInAt, tz, "d MMM yyyy")]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <VisitStatusBadge status={s} />
            <Link href={`/patients/${p.id}`} className={buttonClass("secondary", "sm")}>
              Patient profile
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
        }
      />

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

      {(p.allergies || p.chronicConditions) && (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-600/15 ring-inset">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            {p.allergies && (
              <div>
                <span className="font-semibold">Allergies:</span> {p.allergies}
              </div>
            )}
            {p.chronicConditions && (
              <div>
                <span className="font-semibold">Conditions:</span> {p.chronicConditions}
              </div>
            )}
          </div>
        </div>
      )}

      <NextStep status={s} visitId={visit.id} mayTriage={mayTriage} mayConsult={mayConsult} doctorName={visit.doctor.name} triager={visit.triageBy?.name} />

      {s === "COMPLETED" && visit.pdfGeneratedAt && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">Prescription (PDF)</div>
              <div className="text-xs text-slate-500">Finalized {fmt(visit.pdfGeneratedAt, tz, "d MMM yyyy, h:mm a")}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={`/api/visits/${visit.id}/prescription`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
              Open
            </a>
            <a href={`/api/visits/${visit.id}/prescription?download`} className={buttonClass("primary", "sm")}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={HeartPulse}>Triage · vitals</CardTitle>
        </CardHeader>
        <CardBody>
          {showTriageForm ? (
            <VitalsForm visitId={visit.id} vitals={visit} />
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {vitals.map(({ label, icon: Icon, tone, value, unit }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-canvas/70 p-3 ring-1 ring-brand-900/[0.04]">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <dt className="truncate text-[11px] text-slate-500">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">
                      {value ?? <span className="font-normal text-slate-400">—</span>}
                      {value != null && unit && <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </CardBody>
      </Card>

      {(showConsultForm || ["IN_CONSULTATION", "COMPLETED"].includes(s) || visit.diagnosis) && (
        <Card>
          <CardHeader>
            <CardTitle icon={Stethoscope}>Consultation</CardTitle>
          </CardHeader>
          <CardBody>
            {showConsultForm ? (
              <ConsultationForm
                visitId={visit.id}
                values={{ ...visit, followUpDate: dateOnlyValue(visit.followUpDate) }}
                prescription={visit.prescriptionItems}
              />
            ) : (
              <ConsultationSummary visit={visit} />
            )}
          </CardBody>
        </Card>
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
                  <span className="font-medium text-slate-900">{fmt(v.checkedInAt, tz, "d MMM yyyy")}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {v.doctor.name} · {v.diagnosis || "No diagnosis recorded"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type VitalTile = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  value: string | number | null;
  unit: string;
};

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
        <Button>{label}</Button>
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
      return mayTriage
        ? action("Start triage", startTriage, "Patient has arrived. Open triage to capture vitals.")
        : waiting("Waiting for triage.");
    case "TRIAGE_IN_PROGRESS":
      return mayTriage ? null : waiting(`Triage in progress${triager ? ` with ${triager}` : ""}.`);
    case "TRIAGE_COMPLETED":
      return mayConsult
        ? action("Start consultation", startConsultation, "Triage done. Patient is ready for you.")
        : waiting(`Triage done — waiting for ${doctorName}.`);
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
    advice: string | null;
    followUpDate: Date | null;
    prescriptionItems: { id: string; medicine: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
  };
}) {
  const rows: [string, string | null][] = [
    ["Chief complaint", visit.chiefComplaint],
    ["History", visit.history],
    ["Examination", visit.examination],
    ["Diagnosis", visit.diagnosis],
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
                <span className="text-slate-600">
                  {[i.dosage, i.frequency, i.duration, i.instructions].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
