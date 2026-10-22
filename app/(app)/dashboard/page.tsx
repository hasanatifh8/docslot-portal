import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarOff, CalendarSync, IndianRupee, Siren, CalendarHeart, ClipboardCheck, ClipboardPlus, HeartPulse, Stethoscope, UserRoundPlus, CalendarPlus, BarChart3, Monitor } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { checkInAppointment } from "@/app/actions/opd";
import { formatInTimeZone } from "date-fns-tz";
import { OPEN_STATUSES, type VisitStatus } from "@/lib/encounter";
import { rupees } from "@/lib/money";
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

  const todayDate = new Date(`${dayRange(tz).day}T00:00:00Z`);
  const [dueBills, overdueFollowUps, emergencies, onLeave, longWaits] = await Promise.all([
    can(user.role, "billing.view")
      ? prisma.invoice.findMany({ where: { clinicId: clinic.id, status: { in: ["unpaid", "partial"] }, createdAt: { gte: dayStart, lt: dayEnd } }, select: { total: true, paid: true } })
      : Promise.resolve([]),
    can(user.role, "followups.view")
      ? prisma.visit.count({
          where: { clinicId: clinic.id, status: "COMPLETED", followUpClosedAt: null, followUpDate: { lte: todayDate, gte: new Date(todayDate.getTime() - 30 * 86400_000) }, ...mine },
        })
      : Promise.resolve(0),
    prisma.visit.count({ where: { clinicId: clinic.id, priority: "emergency", status: { in: OPEN_STATUSES }, ...mine } }),
    prisma.doctorLeave.findMany({ where: { doctor: { clinicId: clinic.id }, startDate: { lte: todayDate }, endDate: { gte: todayDate } }, include: { doctor: { select: { name: true } } } }),
    prisma.visit.count({
      where: { clinicId: clinic.id, status: { in: ["CHECKED_IN", "TRIAGE_IN_PROGRESS", "TRIAGE_COMPLETED"] }, checkedInAt: { gte: dayStart, lt: new Date(new Date().getTime() - 45 * 60_000) }, ...mine },
    }),
  ]);
  const dueAmount = dueBills.reduce((s, i) => s + i.total - i.paid, 0);
  const alerts = [
    emergencies > 0 && { href: "/opd", icon: Siren, tone: "bg-rose-600 text-white", text: `${emergencies} emergency patient${emergencies > 1 ? "s" : ""} waiting` },
    longWaits > 0 && { href: "/opd", icon: AlertTriangle, tone: "bg-amber-50 text-amber-900 ring-1 ring-amber-200", text: `${longWaits} waiting over 45 min` },
    dueBills.length > 0 && { href: "/billing", icon: IndianRupee, tone: "bg-white text-slate-800 ring-1 ring-slate-200", text: `${rupees(dueAmount)} to collect · ${dueBills.length} bill${dueBills.length > 1 ? "s" : ""}` },
    overdueFollowUps > 0 && { href: "/follow-ups", icon: CalendarSync, tone: "bg-white text-slate-800 ring-1 ring-slate-200", text: `${overdueFollowUps} follow-up${overdueFollowUps > 1 ? "s" : ""} due` },
    onLeave.length > 0 && { href: "/doctors", icon: CalendarOff, tone: "bg-white text-slate-800 ring-1 ring-slate-200", text: `On leave: ${onLeave.map((l) => l.doctor.name).join(", ")}` },
  ].filter(Boolean) as { href: string; icon: typeof Siren; tone: string; text: string }[];

  const visits = (s: VisitStatus) => visitCounts.find((c) => c.status === s)?._count ?? 0;
  const booked = appts.filter((a) => a.status === "booked").length;
  const now = new Date().getTime();

  return (
    <div>
      <section className="bg-crosses relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-6 text-white shadow-lg shadow-brand-900/15 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-brand-100/80 uppercase">
              {formatInTimeZone(new Date(), tz, "EEEE, d MMMM yyyy")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hello, {greetingName(user.name)}</h1>
            <p className="mt-0.5 text-sm text-brand-100/90">{clinic.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user.role, "appointments.manage") && (
              <Link
                href="/appointments/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-white/25 ring-inset hover:bg-white/20"
              >
                <CalendarHeart className="h-4 w-4" />
                Book
              </Link>
            )}
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

      {alerts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <Link key={a.text} href={a.href} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 ${a.tone}`}>
              <a.icon className="h-4 w-4" /> {a.text} →
            </Link>
          ))}
        </div>
      )}

      <QuickActions role={user.role} />

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

const ACTIONS = [
  { href: "/patients/new", label: "Register patient", hint: "New UHID in 5 steps", icon: UserRoundPlus, perm: "patients.edit", tone: "from-sky-400 to-sky-600 shadow-sky-600/25" },
  { href: "/appointments/new", label: "Book appointment", hint: "Live slots", icon: CalendarPlus, perm: "appointments.manage", tone: "from-violet-400 to-violet-600 shadow-violet-600/25" },
  { href: "/opd?checkin=1", label: "OPD check-in", hint: "Token + fee", icon: ClipboardPlus, perm: "opd.checkin", tone: "from-brand-400 to-brand-700 shadow-brand-700/25" },
  { href: "/opd", label: "My OPD queue", hint: "Ready for you", icon: HeartPulse, perm: "opd.consult", tone: "from-rose-400 to-rose-600 shadow-rose-600/25" },
  { href: "/billing", label: "Collect payment", hint: "Bills due today", icon: IndianRupee, perm: "billing.collect", tone: "from-emerald-400 to-emerald-600 shadow-emerald-600/25" },
  { href: "/follow-ups", label: "Follow-ups", hint: "Remind & rebook", icon: CalendarSync, perm: "followups.view", tone: "from-amber-400 to-amber-600 shadow-amber-600/25" },
  { href: "/reports", label: "Reports", hint: "Today at a glance", icon: BarChart3, perm: "reports.view", tone: "from-indigo-400 to-indigo-600 shadow-indigo-600/25" },
  { href: "/display", label: "Token display", hint: "Waiting-room TV", icon: Monitor, perm: "opd.view", tone: "from-slate-500 to-slate-700 shadow-slate-700/25" },
] as const;

/** Big, colour-coded shortcuts for the jobs this role does most. */
function QuickActions({ role }: { role: string }) {
  const items = ACTIONS.filter((a) => can(role, a.perm)).slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ href, label, hint, icon: Icon, tone }) => (
        <Link
          key={href}
          href={href}
          target={href === "/display" ? "_blank" : undefined}
          className="group shadow-care relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-brand-900/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className={`relative mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tone} transition-transform group-hover:scale-110 group-hover:rotate-[-4deg]`}>
            <div aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent" />
            <Icon className="relative h-6 w-6" />
          </div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-[11px] text-slate-500">{hint}</div>
          <div aria-hidden className="absolute -right-6 -bottom-6 opacity-[0.06] transition-opacity group-hover:opacity-[0.12]">
            <Icon weight="light" className="h-24 w-24 text-slate-900" />
          </div>
        </Link>
      ))}
    </div>
  );
}

/** "Dr. Mehra" → "Dr. Mehra", "Ritu Kapoor" → "Ritu" (keep honorifics with the name). */
function greetingName(name: string) {
  const parts = name.trim().split(/\s+/);
  return /^(dr|mr|mrs|ms|prof)\.?$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}
