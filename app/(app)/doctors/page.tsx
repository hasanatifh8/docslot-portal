import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { WEEKDAYS } from "@/lib/format";
import { minToHHMM } from "@/lib/slots";
import { addDoctor, toggleDoctor, deleteDoctor, setWorkingHours } from "@/app/actions/config";

export default async function DoctorsPage() {
  const user = await requireUser();
  const doctors = await prisma.doctor.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { createdAt: "asc" },
    include: { workingHours: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Doctors &amp; hours</h1>

      <form action={addDoctor} className="grid grid-cols-2 gap-3 rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Name</span>
          <input name="name" required placeholder="Dr. Mehra" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Specialty</span>
          <input name="specialty" required placeholder="Dentist" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Slot length (min)</span>
          <input name="slotMinutes" type="number" defaultValue={15} min={5} max={240} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buffer between slots (min)</span>
          <input name="bufferMinutes" type="number" defaultValue={0} min={0} max={120} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <div className="col-span-2">
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Add doctor
          </button>
        </div>
      </form>

      {doctors.map((d) => {
        const byDay = new Map(d.workingHours.map((w) => [w.weekday, w]));
        return (
          <div key={d.id} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {d.name} <span className="text-sm text-slate-500">· {d.specialty}</span>
                  {!d.active && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">inactive</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {d.slotMinutes}-min slots{d.bufferMinutes ? `, ${d.bufferMinutes}-min buffer` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={toggleDoctor}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                    {d.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={deleteDoctor}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            <form action={setWorkingHours} className="mt-4 space-y-1.5">
              <input type="hidden" name="doctorId" value={d.id} />
              {WEEKDAYS.map((label, wd) => {
                const w = byDay.get(wd);
                return (
                  <div key={wd} className="flex items-center gap-3 text-sm">
                    <label className="flex w-24 items-center gap-2">
                      <input type="checkbox" name={`on-${wd}`} defaultChecked={!!w} />
                      {label}
                    </label>
                    <input
                      type="time"
                      name={`start-${wd}`}
                      defaultValue={w ? minToHHMM(w.startMin) : "09:00"}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      name={`end-${wd}`}
                      defaultValue={w ? minToHHMM(w.endMin) : "17:00"}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                );
              })}
              <button className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Save hours
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
