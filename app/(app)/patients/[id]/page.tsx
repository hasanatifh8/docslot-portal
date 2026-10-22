import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { CalendarClock, CalendarHeart, CalendarPlus, ClipboardList, History, IdCard, IndianRupee, Repeat2, ShieldAlert, UsersRound } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dateOnlyValue, fmt } from "@/lib/format";
import { ageFrom, patientMeta, toPicked } from "@/lib/patients";
import { isOpen, OPEN_STATUSES } from "@/lib/encounter";
import { INVOICE_STATUS_LABELS, rupees } from "@/lib/money";
import { ID_TYPES, relationLabel } from "@/lib/quick-picks";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, buttonClass, statusTone } from "@/components/ui";
import { VisitStatusBadge } from "@/components/visit-status";
import { PatientForm } from "@/components/patient-form";
import { PatientAvatar } from "@/components/patient-avatar";
import { CheckInLauncher } from "@/components/checkin-launcher";

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
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!patient) notFound();

  const canEdit = can(user.role, "patients.edit");
  const canCheckIn = can(user.role, "opd.checkin");
  const canBook = can(user.role, "appointments.manage");
  const openVisit = patient.visits.find((v) => isOpen(v.status));
  const [family, doctors, openCounts] = await Promise.all([
    prisma.patient.findMany({ where: { clinicId: user.clinicId, waPhone: patient.waPhone, id: { not: patient.id } }, orderBy: { createdAt: "asc" } }),
    canCheckIn
      ? prisma.doctor.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, specialty: true, room: true } })
      : Promise.resolve([]),
    canCheckIn ? prisma.visit.groupBy({ by: ["doctorId"], where: { clinicId: user.clinicId, status: { in: OPEN_STATUSES } }, _count: true }) : Promise.resolve([]),
  ]);
  const queueDoctors = doctors.map((d) => ({ ...d, waiting: openCounts.find((c) => c.doctorId === d.id)?._count ?? 0 }));
  const due = patient.invoices.filter((i) => i.status === "unpaid" || i.status === "partial").reduce((s, i) => s + i.total - i.paid, 0);
  const nextFollowUp = patient.visits.find((v) => v.followUpDate && !v.followUpClosedAt && v.followUpDate >= new Date(new Date().getTime() - 30 * 86400_000));
  const upcoming = patient.appointments.filter((a) => a.status === "booked" && a.startAt > new Date()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const facts: [string, React.ReactNode][] = [
    ["Phone", `+${patient.waPhone}${patient.relation ? ` (${relationLabel(patient.relation)})` : ""}`],
    ["Date of birth", patient.dob ? `${fmt(patient.dob, "UTC", "d MMM yyyy")} · ${ageFrom(patient.dob)} y` : null],
    ["Blood group", patient.bloodGroup],
    ["Email", patient.email],
    ["Address", patient.address],
    ["Emergency contact", [patient.emergencyName, patient.emergencyPhone].filter(Boolean).join(" · ") || null],
    ["ID", patient.idType ? `${ID_TYPES.find((t) => t.value === patient.idType)?.label ?? patient.idType} ${patient.idNumber ?? ""}` : null],
    ["Registered", fmt(patient.createdAt, tz, "d MMM yyyy")],
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-crosses relative bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <PatientAvatar name={patient.name} gender={patient.gender} className="h-14 w-14 text-base ring-4 ring-white/20" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{patient.name || "Unnamed patient"}</h1>
              <p className="text-sm text-brand-100">{[patient.uhid, patientMeta(patient), patient.bloodGroup].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCheckIn &&
                (openVisit ? (
                  <Link href={`/opd/${openVisit.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                    In queue · token #{openVisit.token} →
                  </Link>
                ) : (
                  <CheckInLauncher doctors={queueDoctors} canCollect={can(user.role, "billing.collect")} initialPatient={toPicked(patient, patient.visits[0]?.doctorId ?? null)} label="Check in" className="bg-white font-semibold text-brand-800 hover:bg-brand-50" />
                ))}
              {canBook && (
                <Link href={`/appointments/new?patient=${patient.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/20">
                  <CalendarPlus className="h-4 w-4" /> Book
                </Link>
              )}
            </div>
          </div>
        </div>
        {(patient.allergies || patient.chronicConditions) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-rose-50 px-5 py-2.5 text-sm text-rose-900 sm:px-6">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            {patient.allergies && (
              <span>
                <span className="font-semibold">Allergies:</span> {patient.allergies}
              </span>
            )}
            {patient.chronicConditions && (
              <span>
                <span className="font-semibold">Conditions:</span> {patient.chronicConditions}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
          <Stat label="Visits" value={String(patient.visits.filter((v) => v.status === "COMPLETED").length)} />
          <Stat label="Last visit" value={patient.visits[0] ? fmt(patient.visits[0].checkedInAt, tz, "d MMM yyyy") : "—"} />
          <Stat label="Next appointment" value={upcoming[0] ? fmt(upcoming[0].startAt, tz, "d MMM, h:mm a") : nextFollowUp ? `Follow-up ${fmt(nextFollowUp.followUpDate!, "UTC", "d MMM")}` : "—"} />
          <Stat label="Balance due" value={due ? rupees(due) : "Nil"} tone={due ? "amber" : undefined} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle icon={History}>Visit history</CardTitle>
            </CardHeader>
            {patient.visits.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No OPD visits yet" />
            ) : (
              <ol className="relative space-y-0 py-2">
                {patient.visits.map((v) => (
                  <li key={v.id} className="relative pl-10 sm:pl-12">
                    <span aria-hidden className="absolute top-0 bottom-0 left-[1.4rem] w-px bg-slate-200 sm:left-[1.65rem]" />
                    <span aria-hidden className="absolute top-5 left-[1.1rem] h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white sm:left-[1.35rem]" />
                    <Link href={`/opd/${v.id}`} className="block rounded-xl px-3 py-3 hover:bg-slate-50 sm:px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900">
                          {fmt(v.checkedInAt, tz, "d MMM yyyy")} · {v.doctor.name}
                          {v.visitType === "follow_up" && <span className="ml-1.5 text-xs font-normal text-emerald-700">follow-up</span>}
                        </div>
                        <VisitStatusBadge status={v.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {v.diagnosis || v.chiefComplaint || "No notes"}
                        {v.icdCode && ` [${v.icdCode}]`}
                        {v.prescriptionItems.length > 0 && ` · ℞ ${v.prescriptionItems.map((i) => i.medicine).join(", ")}`}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
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
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                    <span className="text-slate-900">
                      {fmt(a.startAt, tz, "d MMM yyyy, h:mm a")}
                      <span className="text-slate-500"> · {a.doctor.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {canBook && a.status === "booked" && a.startAt > new Date() && (
                        <Link href={`/appointments/new?reschedule=${a.id}`} className={buttonClass("ghost", "sm")}>
                          <Repeat2 className="h-3.5 w-3.5" /> Reschedule
                        </Link>
                      )}
                      <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can(user.role, "billing.view") && patient.invoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={IndianRupee}>Bills</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-slate-100">
                {patient.invoices.map((i) => (
                  <li key={i.id}>
                    <Link href={`/billing/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50 sm:px-5">
                      <span>
                        <span className="font-mono text-xs text-slate-500">{i.number}</span>
                        <span className="ml-2 text-slate-900">{fmt(i.createdAt, tz, "d MMM yyyy")}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular font-semibold text-slate-900">{rupees(i.total)}</span>
                        <Badge tone={i.status === "paid" ? "green" : i.status === "void" || i.status === "refunded" ? "slate" : "amber"}>{INVOICE_STATUS_LABELS[i.status]}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle icon={IdCard}>Details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
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
              <CardTitle icon={UsersRound}>Family on +{patient.waPhone}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {family.length === 0 && <p className="text-sm text-slate-500">No one else is registered on this number.</p>}
              {family.map((f) => (
                <Link key={f.id} href={`/patients/${f.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                  <PatientAvatar name={f.name} gender={f.gender} className="h-8 w-8 text-[10px]" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{f.name}</div>
                    <div className="text-xs text-slate-500">{[f.uhid, relationLabel(f.relation), ageFrom(f.dob) != null && `${ageFrom(f.dob)} y`].filter(Boolean).join(" · ")}</div>
                  </div>
                </Link>
              ))}
              {canEdit && (
                <Link href={`/patients/new?phone=${patient.waPhone}`} className={buttonClass("ghost", "sm", "w-full")}>
                  + Register a family member
                </Link>
              )}
            </CardBody>
          </Card>

          {nextFollowUp && (
            <Card className="bg-amber-50/50">
              <CardBody className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900">Follow-up due {fmt(nextFollowUp.followUpDate!, "UTC", "EEE, d MMM yyyy")}</p>
                  <p className="text-amber-800/80">Advised by {nextFollowUp.doctor.name}</p>
                  {canBook && (
                    <Link href={`/appointments/new?patient=${patient.id}&doctor=${nextFollowUp.doctorId}`} className="mt-2 inline-block text-xs font-semibold text-amber-900 underline">
                      Book the follow-up →
                    </Link>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`tabular mt-0.5 truncate text-sm font-semibold ${tone === "amber" ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
