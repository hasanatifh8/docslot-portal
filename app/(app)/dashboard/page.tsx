import Link from "next/link";
import {
  CalendarClock,
  CalendarHeart,
  ClipboardCheck,
  ClipboardPlus,
  HeartPulse,
  Stethoscope,
  UserRoundPlus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { checkInAppointment } from "@/app/actions/opd";
import { formatInTimeZone } from "date-fns-tz";
import type { VisitStatus } from "@/lib/encounter";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EcgLine,
  EmptyState,
  IconChip,
  statusTone,
} from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const clinic = user.clinic;
  const tz = clinic.timezone;
  const { start: dayStart, end: dayEnd } = dayRange(tz);

  // Doctors see their own day; everyone else sees the whole hospital.
  const mine = user.role === "doctor" && user.doctorId ? { doctorId: user.doctorId } : {};
  const canManage = can(user.role, "appointments.manage");
  const canCheckIn = can(user.role, "opd.checkin");

  const [appts, visitCounts, newPatients, totalPatients] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId: clinic.id, startAt: { gte: dayStart, lt: dayEnd }, ...mine },
      orderBy: { startAt: "asc" },
      include: { doctor: true, patient: true, visit: { select: { id: true, token: true } } },
    }),
    prisma.visit.groupBy({
      by: ["status"],
      where: { clinicId: clinic.id, checkedInAt: { gte: dayStart, lt: dayEnd }, ...mine },
      _count: true,
    }),
    prisma.patient.count({ where: { clinicId: clinic.id, createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.patient.count({ where: { clinicId: clinic.id } }),
  ]);

  const visits = (s: VisitStatus) => visitCounts.find((c) => c.status === s)?._count ?? 0;
  const booked = appts.filter((a) => a.status === "booked").length;
  const now = Date.now();

  return (
    <div>
      <section className="bg-crosses relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-6 text-white shadow-lg shadow-brand-900/15 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-brand-100/80 uppercase">
              {formatInTimeZone(new Date(), tz, "EEEE, d MMMM yyyy")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hello, {user.name.split(" ")[0]}</h1>
            <p className="mt-0.5 text-sm text-brand-100/90">{clinic.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user.role, "patients.edit") && (
              <Link
                href="/patients/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/25 ring-inset hover:bg-white/20"
              >
                <UserRoundPlus className="h-4 w-4" />
                Register patient
              </Link>
            )}
            <Link
              href="/opd"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50"
            >
              <ClipboardPlus className="h-4 w-4" />
              OPD queue
            </Link>
          </div>
        </div>
        <EcgLine animated className="relative mt-4 h-8 w-full text-accent-500" />
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={CalendarHeart} label="Appointments" value={booked} sub="still booked today" tone="violet" />
        <Stat
          icon={HeartPulse}
          label="Awaiting triage"
          value={visits("CHECKED_IN") + visits("TRIAGE_IN_PROGRESS")}
          sub={`${visits("TRIAGE_IN_PROGRESS")} in triage now`}
          tone="rose"
        />
        <Stat
          icon={Stethoscope}
          label="With doctor"
          value={visits("TRIAGE_COMPLETED") + visits("IN_CONSULTATION")}
          sub={`${visits("TRIAGE_COMPLETED")} ready · ${visits("IN_CONSULTATION")} in consult`}
          tone="brand"
        />
        <Stat icon={ClipboardCheck} label="Seen today" value={visits("COMPLETED")} tone="emerald" />
        <Stat icon={UserRoundPlus} label="New patients" value={newPatients} sub={`${totalPatients} total`} tone="sky" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle icon={CalendarClock}>{mine.doctorId ? "Your appointments today" : "Today's appointments"}</CardTitle>
        </CardHeader>
        {appts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments today"
            description="New bookings from WhatsApp and the front desk show up here automatically."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appts.map((a) => {
              const past = a.endAt.getTime() < now;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                  <div className="w-14 shrink-0">
                    <div className={`text-sm font-semibold ${past ? "text-slate-400" : "text-slate-900"}`}>
                      {fmt(a.startAt, tz, "h:mm")}
                    </div>
                    <div className="text-[11px] uppercase text-slate-400">{fmt(a.startAt, tz, "a")}</div>
                  </div>
                  <div className="min-w-0 flex-1 basis-32">
                    <Link
                      href={`/patients/${a.patient.id}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {a.patient.name || a.patient.waPhone}
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {a.doctor.name} · {a.doctor.specialty}
                      {a.source === "frontdesk" && " · front desk"}
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                    {a.visit ? (
                      <Link href={`/opd/${a.visit.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Token #{a.visit.token} →
                      </Link>
                    ) : (
                      a.status === "booked" && (
                        <div className="flex gap-1.5">
                          {canCheckIn && (
                            <form action={checkInAppointment}>
                              <input type="hidden" name="appointmentId" value={a.id} />
                              <Button size="sm">Check in</Button>
                            </form>
                          )}
                          {canManage && <StatusButton id={a.id} status="no_show" label="No-show" />}
                          {canManage && <StatusButton id={a.id} status="cancelled" label="Cancel" />}
                        </div>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  tone: React.ComponentProps<typeof IconChip>["tone"];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <IconChip icon={Icon} tone={tone} />
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
    </Card>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button variant="secondary" size="sm">
        {label}
      </Button>
    </form>
  );
}
