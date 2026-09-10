import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt, statusBadge } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-slate-500">
          {formatInTimeZone(new Date(), tz, "EEEE, d MMMM yyyy")} · {clinic.name}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Booked" value={count("booked")} />
        <Stat label="Completed" value={count("completed")} />
        <Stat label="No-shows" value={count("no_show")} />
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {appts.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No appointments today.</p>
        )}
        {appts.map((a) => (
          <div key={a.id} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0">
            <div className="w-16 shrink-0 text-sm font-semibold">{fmt(a.startAt, tz, "h:mm a")}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.patient.name || a.patient.waPhone}</div>
              <div className="truncate text-xs text-slate-500">
                {a.doctor.name} · {a.doctor.specialty}
                {a.source === "frontdesk" && " · front desk"}
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(a.status)}`}>
              {a.status}
            </span>
            {a.status === "booked" && (
              <div className="flex gap-1">
                <StatusButton id={a.id} status="completed" label="Done" />
                <StatusButton id={a.id} status="no_show" label="No-show" />
                <StatusButton id={a.id} status="cancelled" label="Cancel" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        {label}
      </button>
    </form>
  );
}
