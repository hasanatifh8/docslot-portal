import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { WEEKDAYS } from "@/lib/format";
import { minToHHMM } from "@/lib/slots";
import {
  addDoctor,
  toggleDoctor,
  deleteDoctor,
  setWorkingHours,
} from "@/app/actions/config";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";

export default async function DoctorsPage() {
  const user = await requireUser();
  const doctors = await prisma.doctor.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { createdAt: "asc" },
    include: { workingHours: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Doctors & hours" description="Who patients can book, and when" />

      <Card>
        <CardHeader>
          <CardTitle>Add a doctor</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={addDoctor} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input name="name" required placeholder="Dr. Mehra" />
            </Field>
            <Field label="Specialty">
              <Input name="specialty" required placeholder="Dentist" />
            </Field>
            <Field label="Slot length" hint="Minutes per appointment">
              <Input name="slotMinutes" type="number" defaultValue={15} min={5} max={240} />
            </Field>
            <Field label="Buffer" hint="Gap between appointments, minutes">
              <Input name="bufferMinutes" type="number" defaultValue={0} min={0} max={120} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Add doctor</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {doctors.map((d) => {
        const byDay = new Map(d.workingHours.map((w) => [w.weekday, w]));
        return (
          <Card key={d.id}>
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{d.name}</CardTitle>
                  {!d.active && <Badge tone="slate">inactive</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {d.specialty} · {d.slotMinutes}-min slots
                  {d.bufferMinutes ? ` · ${d.bufferMinutes}-min buffer` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={toggleDoctor}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button variant="secondary" size="sm">
                    {d.active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
                <form action={deleteDoctor}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            </CardHeader>
            <CardBody>
              <form action={setWorkingHours} className="space-y-2">
                <input type="hidden" name="doctorId" value={d.id} />
                {WEEKDAYS.map((label, wd) => {
                  const w = byDay.get(wd);
                  return (
                    <div key={wd} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:flex-nowrap">
                      <label className="flex w-20 shrink-0 items-center gap-2 font-medium text-slate-700 sm:w-28">
                        <input
                          type="checkbox"
                          name={`on-${wd}`}
                          defaultChecked={!!w}
                          className="h-4 w-4 rounded border-slate-300 accent-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                        />
                        {label}
                      </label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="time"
                          name={`start-${wd}`}
                          defaultValue={w ? minToHHMM(w.startMin) : "09:00"}
                          className="h-9 w-28 sm:w-32"
                        />
                        <span className="text-slate-400">to</span>
                        <Input
                          type="time"
                          name={`end-${wd}`}
                          defaultValue={w ? minToHHMM(w.endMin) : "17:00"}
                          className="h-9 w-28 sm:w-32"
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2">
                  <Button variant="secondary" size="sm">
                    Save hours
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
