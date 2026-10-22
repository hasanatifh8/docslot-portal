// Doctor availability for one day: working hours minus holidays, the
// doctor's own leave and existing bookings. Used by the booking wizard, the
// WhatsApp bot and the leave planner.
import { prisma } from "@/lib/db";
import { dateOnlyValue } from "@/lib/format";
import { generateSlots, localDateString, upcomingWorkingDates, type Slot } from "@/lib/slots";

/** Clinic-local "yyyy-MM-dd" dates when the clinic is closed or the doctor is on leave. */
export async function closedDates(clinicId: string, doctorId: string, tz: string) {
  const [holidays, leaves] = await Promise.all([
    prisma.holiday.findMany({ where: { clinicId } }),
    prisma.doctorLeave.findMany({ where: { doctorId, endDate: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
  ]);
  const out = new Set(holidays.map((h) => localDateString(h.date, tz)));
  for (const l of leaves) {
    for (let d = new Date(l.startDate); d <= l.endDate; d = new Date(d.getTime() + 24 * 3600_000)) {
      out.add(dateOnlyValue(d));
    }
  }
  return [...out];
}

export async function doctorSlots(
  doctor: { id: string; clinicId: string; slotMinutes: number; bufferMinutes: number; workingHours: { weekday: number; startMin: number; endMin: number }[] },
  date: string,
  tz: string,
  opts: { minLeadMinutes?: number; excludeAppointmentId?: string } = {}
): Promise<{ free: Slot[]; all: (Slot & { taken: boolean })[]; closed: boolean }> {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const [busy, closed] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: "booked",
        startAt: { gte: new Date(dayStart.getTime() - 14 * 3600_000), lt: new Date(dayStart.getTime() + 38 * 3600_000) },
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    closedDates(doctor.clinicId, doctor.id, tz),
  ]);
  const base = {
    timezone: tz,
    slotMinutes: doctor.slotMinutes,
    bufferMinutes: doctor.bufferMinutes,
    workingHours: doctor.workingHours,
    date,
    holidays: closed,
    minLeadMinutes: opts.minLeadMinutes ?? 0,
  };
  const free = generateSlots({ ...base, busy });
  const allSlots = generateSlots({ ...base, busy: [] });
  const freeSet = new Set(free.map((s) => s.startAt.getTime()));
  return {
    free,
    all: allSlots.map((s) => ({ ...s, taken: !freeSet.has(s.startAt.getTime()) })),
    closed: closed.includes(date),
  };
}

export async function upcomingDoctorDates(
  doctor: { id: string; clinicId: string; workingHours: { weekday: number; startMin: number; endMin: number }[] },
  tz: string,
  count: number
) {
  const closed = await closedDates(doctor.clinicId, doctor.id, tz);
  return upcomingWorkingDates({ timezone: tz, workingHours: doctor.workingHours, holidays: closed, count });
}
