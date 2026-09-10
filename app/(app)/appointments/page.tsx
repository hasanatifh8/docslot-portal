import { ClipboardList, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { setAppointmentStatus, frontdeskBook } from "@/app/actions/appointments";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  statusTone,
} from "@/components/ui";

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

      <details className="group mb-6">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
          <Plus className="h-4 w-4 text-slate-400 transition group-open:rotate-45" />
          Book manually (front desk)
        </summary>
        <Card className="mt-3 p-5">
          <form action={frontdeskBook} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Doctor">
              <Select name="doctorId" required>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialty}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Patient name">
              <Input name="patientName" placeholder="Rahul Verma" />
            </Field>
            <Field label="WhatsApp number" hint="With country code, e.g. 919812345678">
              <Input name="waPhone" required placeholder="919812345678" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" name="date" required />
              </Field>
              <Field label="Time">
                <Input type="time" name="time" required />
              </Field>
            </div>
            <Field label="Note (optional)" className="sm:col-span-2">
              <Input name="note" placeholder="Follow-up visit" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Book appointment</Button>
            </div>
          </form>
        </Card>
      </details>

      <Card>
        {appts.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No appointments yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appts.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-36 shrink-0">
                  <div className="text-sm font-medium text-slate-900">{fmt(a.startAt, tz, "d MMM, h:mm a")}</div>
                  <div className="text-xs text-slate-400">{fmt(a.startAt, tz, "EEEE")}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {a.patient.name || a.patient.waPhone}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {a.doctor.name} · {a.doctor.specialty} · {a.patient.waPhone}
                  </div>
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
