import { CalendarX2, CheckCircle2, CalendarClock, UserX } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  statusTone,
} from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const clinic = user.clinic;
  const tz = clinic.timezone;

  const todayStr = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${todayStr}T00:00:00`, tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);

  const [appts, counts] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId: clinic.id, startAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startAt: "asc" },
      include: { doctor: true, patient: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { clinicId: clinic.id, startAt: { gte: dayStart, lt: dayEnd } },
      _count: true,
    }),
  ]);

  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Today"
        description={`${formatInTimeZone(new Date(), tz, "EEEE, d MMMM yyyy")} · ${clinic.name}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CalendarClock} label="Booked" value={count("booked")} tone="text-brand-600" />
        <Stat icon={CheckCircle2} label="Completed" value={count("completed")} tone="text-emerald-600" />
        <Stat icon={UserX} label="No-shows" value={count("no_show")} tone="text-amber-600" />
        <Stat icon={CalendarX2} label="Cancelled" value={count("cancelled")} tone="text-red-500" />
      </div>

      <Card>
        {appts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments today"
            description="New bookings from WhatsApp will show up here automatically."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appts.map((a) => {
              const past = a.endAt.getTime() < now;
              return (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-16 shrink-0">
                    <div className={`text-sm font-semibold ${past ? "text-slate-400" : "text-slate-900"}`}>
                      {fmt(a.startAt, tz, "h:mm")}
                    </div>
                    <div className="text-[11px] uppercase text-slate-400">{fmt(a.startAt, tz, "a")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {a.patient.name || a.patient.waPhone}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {a.doctor.name} · {a.doctor.specialty}
                      {a.source === "frontdesk" && " · front desk"}
                    </div>
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                  {a.status === "booked" && (
                    <div className="flex gap-1.5">
                      <StatusButton id={a.id} status="completed" label="Done" />
                      <StatusButton id={a.id} status="no_show" label="No-show" />
                      <StatusButton id={a.id} status="cancelled" label="Cancel" />
                    </div>
                  )}
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
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
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
