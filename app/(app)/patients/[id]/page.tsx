import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert, CalendarHeart, ClipboardList, ClipboardPlus, History, IdCard, Pencil, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dateOnlyValue, fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";
import { isOpen } from "@/lib/encounter";
import { VisitStatusBadge } from "@/components/visit-status";
import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  statusTone,
} from "@/components/ui";
import { PatientForm } from "@/components/patient-form";
import { CheckInForm } from "@/components/checkin-form";

export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
  const user = await requirePermission("patients.view");
  const tz = user.clinic.timezone;
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      visits: {
        orderBy: { checkedInAt: "desc" },
        take: 50,
        omit: { prescriptionPdf: true },
        include: { doctor: true, prescriptionItems: { orderBy: { sortOrder: "asc" } } },
      },
      appointments: { orderBy: { startAt: "desc" }, take: 20, include: { doctor: true } },
    },
  });
  if (!patient) notFound();

  const canEdit = can(user.role, "patients.edit");
  const canCheckIn = can(user.role, "opd.checkin");
  const openVisit = patient.visits.find((v) => isOpen(v.status));
  const doctors = canCheckIn
    ? await prisma.doctor.findMany({
        where: { clinicId: user.clinicId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, specialty: true },
      })
    : [];

  const facts: [string, string | null][] = [
    ["Phone", `+${patient.waPhone}`],
    ["Date of birth", patient.dob ? fmt(patient.dob, "UTC", "d MMM yyyy") : null],
    ["Blood group", patient.bloodGroup],
    ["Email", patient.email],
    ["Address", patient.address],
    [
      "Emergency contact",
      [patient.emergencyName, patient.emergencyPhone].filter(Boolean).join(" · ") || null,
    ],
    ["Chronic conditions", patient.chronicConditions],
    ["Registered", fmt(patient.createdAt, tz, "d MMM yyyy")],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRound}
        title={patient.name || "Unnamed patient"}
        description={[patient.uhid, patientMeta(patient)].filter(Boolean).join(" · ")}
      />

      {patient.allergies && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-600/15 ring-inset">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <span>
            <span className="font-semibold">Allergies:</span> {patient.allergies}
          </span>
        </div>
      )}

      {canCheckIn && (
        <Card>
          <CardHeader>
            <CardTitle icon={ClipboardPlus}>OPD check-in</CardTitle>
            <CardDescription>Adds the patient to today&apos;s queue with a token number.</CardDescription>
          </CardHeader>
          <CardBody>
            {openVisit ? (
              <p className="text-sm text-slate-600">
                Already in the queue — token #{openVisit.token} with {openVisit.doctor.name}.{" "}
                <Link href={`/opd/${openVisit.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                  Open visit →
                </Link>
              </p>
            ) : (
              <CheckInForm patientId={patient.id} doctors={doctors} />
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={IdCard}>Details</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-slate-900">{v || <span className="text-slate-400">—</span>}</dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <details className="group mt-5 border-t border-slate-100 pt-4">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700">
                <Pencil className="h-3.5 w-3.5" />
                Edit details
              </summary>
              <div className="mt-4">
                <PatientForm patient={{ ...patient, dob: dateOnlyValue(patient.dob) }} />
              </div>
            </details>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={History}>Visit history</CardTitle>
        </CardHeader>
        {patient.visits.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No OPD visits yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {patient.visits.map((v) => (
              <li key={v.id}>
                <Link href={`/opd/${v.id}`} className="block px-4 py-3.5 hover:bg-slate-50 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {fmt(v.checkedInAt, tz, "d MMM yyyy")} · {v.doctor.name}
                    </div>
                    <VisitStatusBadge status={v.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {v.diagnosis || v.chiefComplaint || "No notes"}
                    {v.prescriptionItems.length > 0 &&
                      ` · Rx: ${v.prescriptionItems.map((i) => i.medicine).join(", ")}`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={CalendarHeart}>Appointments</CardTitle>
        </CardHeader>
        {patient.appointments.length === 0 ? (
          <EmptyState title="No appointments" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {patient.appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="text-slate-900">
                  {fmt(a.startAt, tz, "d MMM yyyy, h:mm a")}
                  <span className="text-slate-500"> · {a.doctor.name}</span>
                </span>
                <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
