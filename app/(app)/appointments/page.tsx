import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt, statusBadge } from "@/lib/format";
import { setAppointmentStatus, frontdeskBook } from "@/app/actions/appointments";

export default async function AppointmentsPage() {
  const user = await requireUser();
  const tz = user.clinic.timezone;

  const [appts, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { startAt: "desc" },
      take: 100,
      include: { doctor: true, patient: true },
    }),
    prisma.doctor.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Appointments</h1>

      <details className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-medium">+ Book manually (front desk)</summary>
        <form action={frontdeskBook} className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Doctor</span>
            <select name="doctorId" required className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Patient name</span>
            <input name="patientName" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">WhatsApp number (with country code)</span>
            <input name="waPhone" required placeholder="9198…" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date</span>
              <input type="date" name="date" required className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Time</span>
              <input type="time" name="time" required className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <label className="col-span-2 text-sm">
            <span className="mb-1 block text-slate-600">Note (optional)</span>
            <input name="note" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="col-span-2">
            <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Book
            </button>
          </div>
        </form>
      </details>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {appts.length === 0 && <p className="p-6 text-sm text-slate-500">No appointments yet.</p>}
        {appts.map((a) => (
          <div key={a.id} className="flex items-center gap-4 border-b border-slate-100 p-4 text-sm last:border-0">
            <div className="w-40 shrink-0">
              <div className="font-medium">{fmt(a.startAt, tz, "d MMM, h:mm a")}</div>
              <div className="text-xs text-slate-500">{fmt(a.startAt, tz, "EEEE")}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.patient.name || a.patient.waPhone}</div>
              <div className="truncate text-xs text-slate-500">
                {a.doctor.name} · {a.doctor.specialty} · {a.patient.waPhone}
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(a.status)}`}>{a.status}</span>
            {a.status === "booked" && (
              <form action={setAppointmentStatus}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
