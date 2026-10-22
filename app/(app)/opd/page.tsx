import Link from "next/link";
import { CalendarClock, ClipboardList, ClipboardPlus, Monitor, Siren } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { toPicked } from "@/lib/patients";
import { checkInAppointment } from "@/app/actions/opd";
import { OPEN_STATUSES, PIPELINE, STATUS_LABELS, type VisitStatus } from "@/lib/encounter";
import { byQueueOrder, minutesSince, waitLabel } from "@/lib/queue";
import { flagVital } from "@/lib/clinical";
import { AutoRefresh, VisitStatusBadge } from "@/components/visit-status";
import { STAGE_ICONS } from "@/components/stage-icons";
import { Badge, Button, Card, CardHeader, CardTitle, PageHeader, buttonClass, chipClass, cn } from "@/components/ui";
import { CheckInLauncher } from "@/components/checkin-launcher";

export default async function OpdPage({ searchParams }: PageProps<"/opd">) {
  const user = await requirePermission("opd.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  // Doctors land on their own queue; "all" shows everyone.
  const doctorParam = typeof sp.doctor === "string" ? sp.doctor : user.role === "doctor" && user.doctorId ? user.doctorId : "all";
  const doctorFilter = doctorParam === "all" ? {} : { doctorId: doctorParam };
  const { start, end } = dayRange(tz);
  const canCheckIn = can(user.role, "opd.checkin");
  const preselect = typeof sp.patient === "string" ? sp.patient : null;

  const [doctors, visits, expected, openCounts, picked] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: user.clinicId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialty: true, room: true },
    }),
    prisma.visit.findMany({
      where: { clinicId: user.clinicId, checkedInAt: { gte: start, lt: end }, ...doctorFilter },
      orderBy: [{ checkedInAt: "asc" }],
      omit: { prescriptionPdf: true },
      include: { patient: true, doctor: true, triageBy: { select: { name: true } }, invoice: { select: { status: true } } },
    }),
    prisma.appointment.findMany({
      where: { clinicId: user.clinicId, status: "booked", startAt: { gte: start, lt: end }, visit: null, ...doctorFilter },
      orderBy: { startAt: "asc" },
      include: { patient: true, doctor: true },
    }),
    prisma.visit.groupBy({
      by: ["doctorId"],
      where: { clinicId: user.clinicId, status: { in: OPEN_STATUSES }, checkedInAt: { gte: start, lt: end } },
      _count: true,
    }),
    preselect
      ? prisma.patient.findFirst({
          where: { id: preselect, clinicId: user.clinicId },
          include: { visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { doctorId: true } } },
        })
      : null,
  ]);

  const queueDoctors = doctors.map((d) => ({ ...d, waiting: openCounts.find((c) => c.doctorId === d.id)?._count ?? 0 }));
  const order: VisitStatus[] =
    user.role === "doctor"
      ? ["TRIAGE_COMPLETED", "IN_CONSULTATION", "TRIAGE_IN_PROGRESS", "CHECKED_IN", "COMPLETED", "CANCELLED"]
      : ["CHECKED_IN", "TRIAGE_IN_PROGRESS", "TRIAGE_COMPLETED", "IN_CONSULTATION", "COMPLETED", "CANCELLED"];
  const hints: Partial<Record<VisitStatus, string>> = {
    CHECKED_IN: "Awaiting triage — emergencies first",
    TRIAGE_IN_PROGRESS: "Vitals being captured",
    TRIAGE_COMPLETED: "Vitals done — next in for consultation",
  };
  const groups = order
    .map((key) => ({ key, visits: visits.filter((v) => v.status === key).sort(byQueueOrder) }))
    .filter((g) => g.visits.length > 0 || PIPELINE.slice(0, 4).includes(g.key as (typeof PIPELINE)[number]));
  const count = (st: VisitStatus) => visits.filter((v) => v.status === st).length;
  const emergencies = visits.filter((v) => v.priority === "emergency" && OPEN_STATUSES.includes(v.status)).length;
  const now = new Date().getTime();
  const href = (doctor: string) => `/opd?doctor=${doctor}`;

  return (
    <div className="space-y-5">
      <AutoRefresh />
      <PageHeader
        icon={ClipboardPlus}
        title="OPD queue"
        description={`${fmt(new Date(), tz, "EEEE, d MMMM")} · updates live`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/display" target="_blank" className={buttonClass("secondary", "md")} title="Open the waiting-room TV screen">
              <Monitor className="h-4 w-4" /> <span className="hidden sm:inline">Token display</span>
            </Link>
            {canCheckIn && (
              <CheckInLauncher
                doctors={queueDoctors}
                canCollect={can(user.role, "billing.collect")}
                initialPatient={picked ? toPicked(picked, picked.visits[0]?.doctorId ?? null) : null}
                autoOpen={sp.checkin === "1"}
              />
            )}
          </div>
        }
      />

      {emergencies > 0 && (
        <div className="alert-pulse flex items-center gap-3 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white">
          <Siren className="h-5 w-5" /> {emergencies} emergency patient{emergencies > 1 ? "s" : ""} in the queue — shown first.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Link href={href("all")} className={chipClass(doctorParam === "all")}>
          All doctors
        </Link>
        {queueDoctors.map((d) => (
          <Link key={d.id} href={href(d.id)} className={chipClass(doctorParam === d.id)}>
            {d.name}
            <span className={cn("rounded-full px-1.5 text-[10px]", doctorParam === d.id ? "bg-white/20" : "bg-slate-100")}>{d.waiting}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PIPELINE.map((st, i) => {
          const Icon = STAGE_ICONS[st];
          return (
            <Card key={st} className="relative overflow-hidden px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400">STEP {i + 1}</span>
                <Icon className="h-4 w-4 text-brand-500" />
              </div>
              <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{count(st)}</div>
              <div className="truncate text-[11px] font-medium text-slate-500">{STATUS_LABELS[st]}</div>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-400 to-brand-600" style={{ opacity: 0.25 + i * 0.18 }} />
            </Card>
          );
        })}
      </div>

      {expected.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle icon={CalendarClock}>Booked today · not yet arrived</CardTitle>
            <span className="text-xs text-slate-400">{expected.length}</span>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {expected.map((a) => {
              const late = a.startAt.getTime() < now - 10 * 60_000;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <div className={cn("tabular w-16 shrink-0 text-sm font-semibold", late ? "text-amber-600" : "text-slate-900")}>{fmt(a.startAt, tz, "h:mm a")}</div>
                  <div className="min-w-0 flex-1 basis-32">
                    <div className="truncate text-sm font-medium text-slate-900">{a.patient.name || a.patient.waPhone}</div>
                    <div className="truncate text-xs text-slate-500">
                      {a.doctor.name}
                      {a.note && ` · ${a.note}`}
                    </div>
                  </div>
                  {late && <Badge tone="amber">Late</Badge>}
                  {canCheckIn && (
                    <form action={checkInAppointment}>
                      <input type="hidden" name="appointmentId" value={a.id} />
                      <Button size="sm">Arrived · check in</Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {groups.map((g) => (
        <Card key={g.key}>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle icon={STAGE_ICONS[g.key]}>{STATUS_LABELS[g.key]}</CardTitle>
              {hints[g.key] && <p className="mt-0.5 text-xs text-slate-500">{hints[g.key]}</p>}
            </div>
            <span className="text-xs text-slate-400">{g.visits.length}</span>
          </CardHeader>
          {g.visits.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-400">
              <ClipboardList className="h-4 w-4" />
              Nobody at this step right now.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {g.visits.map((v) => {
                const waited = minutesSince(v.checkedInAt, now);
                const open = OPEN_STATUSES.includes(v.status);
                const critical = (["bpSystolic", "pulse", "spo2", "temperatureC"] as const).some((k) => flagVital(k, v[k]) === "critical");
                return (
                  <li key={v.id}>
                    <Link
                      href={`/opd/${v.id}`}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap sm:px-5",
                        v.priority === "emergency" && open && "bg-rose-50/60 hover:bg-rose-50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-sm",
                          v.priority === "emergency" ? "bg-gradient-to-br from-rose-500 to-rose-700" : v.priority === "priority" ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-brand-500 to-brand-700"
                        )}
                      >
                        <span className="text-[8px] leading-none font-medium tracking-wider uppercase opacity-80">Token</span>
                        <span className="tabular text-sm leading-tight font-bold">{v.token}</span>
                      </div>
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                          {v.patient.name || v.patient.waPhone}
                          <span className="font-normal text-slate-400">· {v.patient.uhid}</span>
                          {v.patient.allergies && (
                            <span className="rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700" title={`Allergies: ${v.patient.allergies}`}>
                              ALLERGY
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {v.doctor.name} · in at {fmt(v.checkedInAt, tz, "h:mm a")}
                          {v.chiefComplaint && ` · ${v.chiefComplaint}`}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {v.priority !== "normal" && open && <Badge tone={v.priority === "emergency" ? "red" : "amber"}>{v.priority}</Badge>}
                        {v.visitType === "follow_up" && <Badge tone="slate" className="normal-case">Follow-up</Badge>}
                        {critical && <Badge tone="red">Critical vitals</Badge>}
                        {open && (
                          <span className={cn("tabular text-xs", waited > 45 ? "font-semibold text-rose-600" : waited > 20 ? "text-amber-600" : "text-slate-400")}>
                            {waitLabel(waited)}
                          </span>
                        )}
                        {v.invoice && v.invoice.status !== "paid" && v.invoice.status !== "void" && <Badge tone="amber">₹ due</Badge>}
                        <VisitStatusBadge status={v.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
