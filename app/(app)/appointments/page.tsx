import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarClock, CalendarHeart, CalendarPlus, Repeat2 } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { checkInAppointment } from "@/app/actions/opd";
import { Badge, Button, Card, CardHeader, CardTitle, EmptyState, chipClass, PageHeader, buttonClass, cn, statusTone } from "@/components/ui";
import { PatientAvatar } from "@/components/patient-avatar";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const user = await requirePermission("appointments.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const canManage = can(user.role, "appointments.manage");
  const canCheckIn = can(user.role, "opd.checkin");
  const today = dayRange(tz).day;
  const dateParam = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { day, start, end } = dayRange(tz, dateParam);
  const doctorParam = typeof sp.doctor === "string" ? sp.doctor : user.role === "doctor" && user.doctorId ? user.doctorId : "all";
  const status = typeof sp.status === "string" ? sp.status : "all";

  const [doctors, appts] = await Promise.all([
    prisma.doctor.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" } }),
    prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        startAt: { gte: start, lt: end },
        ...(doctorParam !== "all" ? { doctorId: doctorParam } : {}),
      },
      orderBy: { startAt: "asc" },
      include: { doctor: true, patient: true, visit: { select: { id: true, token: true } } },
    }),
  ]);
  const shown = status === "all" ? appts : appts.filter((a) => a.status === status);
  const count = (s: string) => appts.filter((a) => a.status === s).length;
  const href = (o: Record<string, string>) => {
    const q = new URLSearchParams({ date: day, doctor: doctorParam, status, ...o });
    return `/appointments?${q}`;
  };
  const isToday = day === today;
  const now = new Date().getTime();

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarHeart}
        title="Appointments"
        description={`${fmt(start, tz, "EEEE, d MMMM yyyy")}${isToday ? " · today" : ""}`}
        actions={
          canManage && (
            <Link href="/appointments/new" className={buttonClass("primary", "md")}>
              <CalendarPlus className="h-4 w-4" /> Book appointment
            </Link>
          )
        }
      />

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Link href={href({ date: shift(day, -1) })} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={href({ date: today })} className={buttonClass(isToday ? "primary" : "secondary", "sm")}>
            Today
          </Link>
          <Link href={href({ date: shift(day, 1) })} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <form className="ml-1">
            <input type="hidden" name="doctor" value={doctorParam} />
            <input type="hidden" name="status" value={status} />
            <input
              type="date"
              name="date"
              defaultValue={day}
              className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
              aria-label="Jump to date"
            />
            <button className="sr-only">Go</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:ml-auto">
          <Link href={href({ doctor: "all" })} className={chipClass(doctorParam === "all")}>
            All doctors
          </Link>
          {doctors.map((d) => (
            <Link key={d.id} href={href({ doctor: d.id })} className={chipClass(doctorParam === d.id)}>
              {d.name}
            </Link>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Link key={s.value} href={href({ status: s.value })} className={chipClass(status === s.value)}>
            {s.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", status === s.value ? "bg-white/20" : "bg-slate-100")}>
              {s.value === "all" ? appts.length : count(s.value)}
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle icon={CalendarClock}>
            {shown.length} appointment{shown.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        {shown.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            description={canManage ? "Use “Book appointment” to add one — WhatsApp bookings appear here automatically." : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((a) => {
              const past = a.endAt.getTime() < now;
              const open = a.status === "booked" && !a.visit;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                  <div className="tabular w-16 shrink-0">
                    <div className={cn("text-sm font-semibold", past && a.status === "booked" ? "text-amber-600" : "text-slate-900")}>
                      {fmt(a.startAt, tz, "h:mm")}
                    </div>
                    <div className="text-[11px] text-slate-400 uppercase">{fmt(a.startAt, tz, "a")}</div>
                  </div>
                  <PatientAvatar name={a.patient.name} gender={a.patient.gender} className="hidden h-9 w-9 sm:flex" />
                  <div className="min-w-0 flex-1 basis-40">
                    <Link href={`/patients/${a.patient.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {a.patient.name || a.patient.waPhone}
                      <span className="font-normal text-slate-400"> · {a.patient.uhid}</span>
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {a.doctor.name}
                      {a.doctor.room && ` · Room ${a.doctor.room}`} · {a.source === "frontdesk" ? "Front desk" : "WhatsApp"}
                      {a.note && ` · ${a.note}`}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto">
                    {past && a.status === "booked" && !a.visit && <Badge tone="amber">Late</Badge>}
                    <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                    {a.visit ? (
                      <Link href={`/opd/${a.visit.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Token #{a.visit.token} →
                      </Link>
                    ) : (
                      open && (
                        <>
                          {canCheckIn && isToday && (
                            <form action={checkInAppointment}>
                              <input type="hidden" name="appointmentId" value={a.id} />
                              <Button size="sm">Check in</Button>
                            </form>
                          )}
                          {canManage && (
                            <Link href={`/appointments/new?reschedule=${a.id}`} className={buttonClass("secondary", "sm")} title="Reschedule">
                              <Repeat2 className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Reschedule</span>
                            </Link>
                          )}
                          {canManage && past && <StatusButton id={a.id} status="no_show" label="No-show" />}
                          {canManage && <StatusButton id={a.id} status="cancelled" label="Cancel" />}
                        </>
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

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button variant={status === "cancelled" ? "danger" : "secondary"} size="sm">
        {label}
      </Button>
    </form>
  );
}
