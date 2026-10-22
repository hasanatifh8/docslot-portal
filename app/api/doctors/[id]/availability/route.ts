import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { doctorSlots, upcomingDoctorDates } from "@/lib/availability";

/**
 * Booking wizard data.
 *   (no date)   → next 14 working days with free-slot counts
 *   ?date=…     → every slot that day, marked free / taken
 * `exclude` ignores one appointment (when rescheduling it).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/doctors/[id]/availability">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "appointments.view")) return Response.json({}, { status: 401 });
  const { id } = await ctx.params;
  const tz = user.clinic.timezone;
  const doctor = await prisma.doctor.findFirst({
    where: { id, clinicId: user.clinicId, active: true },
    include: { workingHours: true },
  });
  if (!doctor) return Response.json({ error: "Doctor not found" }, { status: 404 });

  const date = req.nextUrl.searchParams.get("date");
  const exclude = req.nextUrl.searchParams.get("exclude") ?? undefined;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { all, closed } = await doctorSlots(doctor, date, tz, { excludeAppointmentId: exclude });
    const now = Date.now();
    return Response.json({
      closed,
      slots: all.map((s) => ({
        start: s.startAt.toISOString(),
        end: s.endAt.toISOString(),
        label: s.label,
        taken: s.taken,
        past: s.startAt.getTime() < now,
      })),
    });
  }

  const dates = await upcomingDoctorDates(doctor, tz, 14);
  const days = await Promise.all(
    dates.map(async (d) => {
      const { free } = await doctorSlots(doctor, d, tz, { excludeAppointmentId: exclude });
      return { date: d, free: free.filter((s) => s.startAt.getTime() > Date.now()).length };
    })
  );
  return Response.json({ days });
}
