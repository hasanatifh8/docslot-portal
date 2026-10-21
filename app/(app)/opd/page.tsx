import Link from "next/link";
import { CalendarClock, ClipboardList, ClipboardPlus, Search, UserRoundPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";
import { checkInAppointment } from "@/app/actions/opd";
import { PIPELINE, STATUS_LABELS, type VisitStatus } from "@/lib/encounter";
import { AutoRefresh, VisitStatusBadge } from "@/components/visit-status";
import { STAGE_ICONS } from "@/components/stage-icons";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
  buttonClass,
} from "@/components/ui";
import { CheckInForm } from "@/components/checkin-form";

export default async function OpdPage({ searchParams }: PageProps<"/opd">) {
  const user = await requirePermission("opd.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  // Doctors land on their own queue; "all" shows everyone.
  const doctorParam = typeof sp.doctor === "string" ? sp.doctor : user.role === "doctor" && user.doctorId ? user.doctorId : "all";
  const doctorFilter = doctorParam === "all" ? {} : { doctorId: doctorParam };
  const { start, end } = dayRange(tz);
  const canCheckIn = can(user.role, "opd.checkin");

  const digits = q.replace(/\D/g, "");
  const [doctors, visits, expected, matches] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: user.clinicId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialty: true },
    }),
    prisma.visit.findMany({
      where: { clinicId: user.clinicId, checkedInAt: { gte: start, lt: end }, ...doctorFilter },
      orderBy: [{ checkedInAt: "asc" }],
      omit: { prescriptionPdf: true },
      include: { patient: true, doctor: true, triageBy: { select: { name: true } } },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        status: "booked",
        startAt: { gte: start, lt: end },
        visit: null,
        ...doctorFilter,
      },
      orderBy: { startAt: "asc" },
      include: { patient: true, doctor: true },
    }),
    canCheckIn && q
      ? prisma.patient.findMany({
          where: {
            clinicId: user.clinicId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { uhid: { contains: q, mode: "insensitive" } },
              ...(digits.length >= 3 ? [{ waPhone: { contains: digits } }] : []),
            ],
          },
          take: 8,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Lanes, most actionable first for the person looking.
  const order: VisitStatus[] =
    user.role === "doctor"
      ? ["TRIAGE_COMPLETED", "IN_CONSULTATION", "TRIAGE_IN_PROGRESS", "CHECKED_IN", "COMPLETED", "CANCELLED"]
      : ["CHECKED_IN", "TRIAGE_IN_PROGRESS", "TRIAGE_COMPLETED", "IN_CONSULTATION", "COMPLETED", "CANCELLED"];
  const hints: Partial<Record<VisitStatus, string>> = {
    CHECKED_IN: "Awaiting triage",
    TRIAGE_IN_PROGRESS: "Vitals being captured",
    TRIAGE_COMPLETED: "Queued for senior doctor",
  };
  const groups = order
    .map((key) => ({ key, visits: visits.filter((v) => v.status === key) }))
    .filter((g) => g.visits.length > 0 || PIPELINE.slice(0, 4).includes(g.key as (typeof PIPELINE)[number]));
  const count = (st: VisitStatus) => visits.filter((v) => v.status === st).length;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        icon={ClipboardPlus}
        title="OPD queue"
        description={`${fmt(new Date(), tz, "EEEE, d MMMM")} · updates live`}
        actions={
          <form className="flex items-center gap-2">
            {q && <input type="hidden" name="q" value={q} />}
            <Select name="doctor" defaultValue={doctorParam} className="w-52">
              <option value="all">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary">Filter</Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PIPELINE.map((st, i) => {
          const Icon = STAGE_ICONS[st];
          return (
            <Card key={st} className="relative overflow-hidden px-3 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400">STEP {i + 1}</span>
                <Icon className="h-4 w-4 text-brand-500" />
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{count(st)}</div>
              <div className="truncate text-[11px] font-medium text-slate-500">{STATUS_LABELS[st]}</div>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-400 to-brand-600" style={{ opacity: 0.25 + i * 0.18 }} />
            </Card>
          );
        })}
      </div>

      {canCheckIn && (
        <Card>
          <CardHeader>
            <CardTitle icon={UserRoundPlus}>Walk-in check-in</CardTitle>
            <CardDescription>Find the patient, pick a doctor, and they get the next token.</CardDescription>
          </CardHeader>
          <div className="space-y-3 p-5">
            <form className="flex gap-2">
              {doctorParam !== "all" && <input type="hidden" name="doctor" value={doctorParam} />}
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input name="q" defaultValue={q} placeholder="Name, UHID or phone" className="pl-9" />
              </div>
              <Button variant="secondary">Search</Button>
              <Link href="/patients/new" className={buttonClass("secondary", "md")} title="Register new patient">
                <UserRoundPlus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Link>
            </form>
            {q && matches.length === 0 && <p className="text-sm text-slate-500">No patients match “{q}”.</p>}
            {matches.map((p) => (
              <div key={p.id} className="rounded-xl p-3 ring-1 ring-slate-200">
                <div className="mb-2 text-sm">
                  <span className="font-medium text-slate-900">{p.name || "Unnamed"}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {[p.uhid, patientMeta(p), `+${p.waPhone}`].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <CheckInForm patientId={p.id} doctors={doctors} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {expected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle icon={CalendarClock}>Booked today, not yet arrived</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {expected.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <div className="w-16 shrink-0 text-sm font-semibold text-slate-900">{fmt(a.startAt, tz, "h:mm a")}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{a.patient.name || a.patient.waPhone}</div>
                  <div className="truncate text-xs text-slate-500">{a.doctor.name}</div>
                </div>
                {canCheckIn && (
                  <form action={checkInAppointment}>
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <Button size="sm">Check in</Button>
                  </form>
                )}
              </li>
            ))}
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
              {g.visits.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/opd/${v.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap sm:px-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/20">
                      <span className="text-[8px] leading-none font-medium tracking-wider text-brand-100 uppercase">Token</span>
                      <span className="text-sm leading-tight font-bold">{v.token}</span>
                    </div>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {v.patient.name || v.patient.waPhone}
                        <span className="font-normal text-slate-400"> · {v.patient.uhid}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {v.doctor.name} · in at {fmt(v.checkedInAt, tz, "h:mm a")}
                        {v.chiefComplaint && ` · ${v.chiefComplaint}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.status === "TRIAGE_IN_PROGRESS" && v.triageBy && (
                        <span className="text-xs text-slate-400">{v.triageBy.name}</span>
                      )}
                      {v.status === "TRIAGE_COMPLETED" && v.bpSystolic != null && (
                        <Badge tone="slate" className="normal-case">
                          BP {v.bpSystolic}/{v.bpDiastolic}
                        </Badge>
                      )}
                      <VisitStatusBadge status={v.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
