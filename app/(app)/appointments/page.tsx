import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { Badge, Button, Card, EmptyState, PageHeader, statusTone } from "@/components/ui";
import { FrontdeskForm } from "@/components/frontdesk-form";

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
    prisma.doctor.findMany({
      where: { clinicId: user.clinicId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Appointments" description="Every booking, newest first" />

      <FrontdeskForm doctors={doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty }))} />

      <Card>
        {appts.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No appointments yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                <div className="w-28 shrink-0 sm:w-36">
                  <div className="text-sm font-medium text-slate-900">{fmt(a.startAt, tz, "d MMM, h:mm a")}</div>
                  <div className="text-xs text-slate-400">{fmt(a.startAt, tz, "EEEE")}</div>
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {a.patient.name || a.patient.waPhone}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {a.doctor.name} · {a.doctor.specialty} · {a.patient.waPhone}
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                  {a.status === "booked" && (
                    <form action={setAppointmentStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <Button variant="secondary" size="sm">
                        Cancel
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
