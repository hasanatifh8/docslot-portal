import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { WEEKDAYS } from "@/lib/format";
import { minToHHMM } from "@/lib/slots";
import {
  addDoctor,
  toggleDoctor,
  deleteDoctor,
  setWorkingHours,
  setDoctorDepartment,
  addDepartment,
  deleteDepartment,
  updateDoctorPractice,
  addLeave,
  deleteLeave,
  cancelLeaveBookings,
} from "@/app/actions/config";
import { BadgePlus, Building2, CalendarOff, IndianRupee, Stethoscope, Trash2 } from "@/components/icons";
import { dateOnlyValue, fmt } from "@/lib/format";
import { fromZonedTime } from "date-fns-tz";
import { rupeeInput, rupees } from "@/lib/money";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";

export default async function DoctorsPage() {
  const user = await requirePermission("doctors.manage");
  const [doctors, departments] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { createdAt: "asc" },
      include: {
        workingHours: true,
        department: true,
        leaves: { where: { endDate: { gte: new Date(new Date().getTime() - 86400_000) } }, orderBy: { startDate: "asc" } },
        _count: { select: { visits: true, appointments: true } },
      },
    }),
    prisma.department.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { name: "asc" },
      include: { _count: { select: { doctors: true } } },
    }),
  ]);
  const tz = user.clinic.timezone;
  // Bookings that fall inside each upcoming leave, so the admin can clear them in one go.
  const leaveBookings = new Map<string, number>();
  for (const d of doctors) {
    for (const l of d.leaves) {
      const n = await prisma.appointment.count({
        where: {
          doctorId: d.id,
          status: "booked",
          startAt: {
            gte: fromZonedTime(`${dateOnlyValue(l.startDate)}T00:00:00`, tz),
            lt: new Date(fromZonedTime(`${dateOnlyValue(l.endDate)}T00:00:00`, tz).getTime() + 24 * 3600_000),
          },
        },
      });
      leaveBookings.set(l.id, n);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Stethoscope} title="Doctors & departments" description="Departments, doctors, and OPD hours" />

      <Card>
        <CardHeader>
          <CardTitle icon={Building2}>Departments</CardTitle>
          <CardDescription>Group doctors by department, e.g. General Medicine, Orthopaedics, Paediatrics.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <form action={addDepartment} className="flex gap-2">
            <Input name="name" required minLength={2} placeholder="Cardiology" className="flex-1" />
            <Button variant="secondary">Add</Button>
          </form>
          {departments.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {departments.map((dep) => (
                <li
                  key={dep.id}
                  className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-1.5 pl-3 text-sm text-slate-700"
                >
                  {dep.name}
                  <span className="text-xs text-slate-400">{dep._count.doctors}</span>
                  <form action={deleteDepartment}>
                    <input type="hidden" name="id" value={dep.id} />
                    <button className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-600" aria-label={`Delete ${dep.name}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No departments yet.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={BadgePlus}>Add a doctor</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={addDoctor} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input name="name" required placeholder="Dr. Mehra" />
            </Field>
            <Field label="Specialty">
              <Input name="specialty" required placeholder="Cardiologist" />
            </Field>
            <Field label="Department">
              <Select name="departmentId" defaultValue="">
                <option value="">None</option>
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qualification" hint="Printed on prescriptions">
              <Input name="qualification" placeholder="MBBS, MD" />
            </Field>
            <Field label="Registration no." hint="Medical council registration">
              <Input name="registrationNo" placeholder="MMC 123456" />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Slot length" hint="Minutes per appointment">
              <Input name="slotMinutes" type="number" defaultValue={15} min={5} max={240} />
            </Field>
            <Field label="Buffer" hint="Gap between appointments, minutes">
              <Input name="bufferMinutes" type="number" defaultValue={0} min={0} max={120} />
            </Field>
            <Field label="Consultation fee (₹)" hint="New visit">
              <Input name="consultFee" inputMode="decimal" defaultValue="500" />
            </Field>
            <Field label="Follow-up fee (₹)" hint="Within the follow-up window">
              <Input name="followUpFee" inputMode="decimal" defaultValue="0" />
            </Field>
            <Field label="Follow-up window" hint="Days after a visit that count as follow-up">
              <Input name="followUpDays" type="number" defaultValue={7} min={0} max={60} />
            </Field>
            <Field label="Room / cabin" hint="Shown on the token display">
              <Input name="room" placeholder="3" />
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
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle icon={Stethoscope}>{d.name}</CardTitle>
                  {!d.active && <Badge tone="slate">inactive</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {d.department ? `${d.department.name} · ` : ""}
                  {d.specialty}
                  {d.qualification ? ` · ${d.qualification}` : ""} · {d.slotMinutes}-min slots
                  {d.bufferMinutes ? ` · ${d.bufferMinutes}-min buffer` : ""} · fee {rupees(d.consultFee)}
                  {d.room ? ` · Room ${d.room}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <form action={setDoctorDepartment} className="flex gap-1.5">
                  <input type="hidden" name="id" value={d.id} />
                  <Select name="departmentId" defaultValue={d.departmentId ?? ""} className="h-8 w-36 text-xs" aria-label="Department">
                    <option value="">No department</option>
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" size="sm">
                    Set
                  </Button>
                </form>
                <form action={toggleDoctor}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button variant="secondary" size="sm">
                    {d.active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
                {d._count.visits + d._count.appointments === 0 && (
                  <form action={deleteDoctor}>
                    <input type="hidden" name="id" value={d.id} />
                    <Button variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              <form action={updateDoctorPractice} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
                <input type="hidden" name="id" value={d.id} />
                <IndianRupee className="mb-2.5 h-4 w-4 text-brand-500" />
                <Field label="Fee (₹)" className="w-24">
                  <Input name="consultFee" defaultValue={rupeeInput(d.consultFee)} inputMode="decimal" className="h-9" />
                </Field>
                <Field label="Follow-up fee (₹)" className="w-28">
                  <Input name="followUpFee" defaultValue={rupeeInput(d.followUpFee)} inputMode="decimal" className="h-9" />
                </Field>
                <Field label="Follow-up within (days)" className="w-36">
                  <Input name="followUpDays" type="number" defaultValue={d.followUpDays} min={0} max={60} className="h-9" />
                </Field>
                <Field label="Room" className="w-20">
                  <Input name="room" defaultValue={d.room ?? ""} className="h-9" />
                </Field>
                <Button variant="secondary" size="sm" className="mb-0.5">
                  Save
                </Button>
              </form>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <CalendarOff className="h-3.5 w-3.5" /> Leave
                </div>
                {d.leaves.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {d.leaves.map((l) => {
                      const n = leaveBookings.get(l.id) ?? 0;
                      return (
                        <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-sm ring-1 ring-amber-200/70">
                          <span className="font-medium text-amber-900">
                            {fmt(l.startDate, "UTC", "d MMM")}
                            {l.endDate.getTime() !== l.startDate.getTime() && ` – ${fmt(l.endDate, "UTC", "d MMM yyyy")}`}
                          </span>
                          {l.reason && <span className="text-xs text-amber-800">· {l.reason}</span>}
                          {n > 0 ? (
                            <form action={cancelLeaveBookings} className="ml-auto">
                              <input type="hidden" name="id" value={l.id} />
                              <Button variant="danger" size="sm">
                                Cancel {n} booking{n > 1 ? "s" : ""} & notify patients
                              </Button>
                            </form>
                          ) : (
                            <span className="ml-auto text-xs text-amber-800/70">No bookings affected</span>
                          )}
                          <form action={deleteLeave}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-700/60 hover:bg-white hover:text-rose-600" aria-label="Remove leave">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form action={addLeave} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="doctorId" value={d.id} />
                  <Field label="From" className="w-40">
                    <Input type="date" name="startDate" required className="h-9" />
                  </Field>
                  <Field label="To" className="w-40">
                    <Input type="date" name="endDate" className="h-9" />
                  </Field>
                  <Field label="Reason" className="min-w-40 flex-1">
                    <Input name="reason" placeholder="Conference, personal…" className="h-9" />
                  </Field>
                  <Button variant="secondary" size="sm" className="mb-0.5">
                    Add leave
                  </Button>
                </form>
                <p className="mt-1 text-[11px] text-slate-400">No slots are offered on leave days — on WhatsApp or at the front desk.</p>
              </div>

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
