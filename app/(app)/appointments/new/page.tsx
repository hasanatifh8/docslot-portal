import { notFound } from "next/navigation";
import { CalendarPlus } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { toPicked } from "@/lib/patients";
import { PageHeader } from "@/components/ui";
import { BookingWizard } from "@/components/booking-wizard";

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const user = await requirePermission("appointments.manage");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const patientId = typeof sp.patient === "string" ? sp.patient : null;
  const doctorParam = typeof sp.doctor === "string" ? sp.doctor : null;
  const rescheduleId = typeof sp.reschedule === "string" ? sp.reschedule : null;

  const [doctors, reschedule] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId: user.clinicId, active: true },
      orderBy: { name: "asc" },
      include: { department: true },
    }),
    rescheduleId
      ? prisma.appointment.findFirst({ where: { id: rescheduleId, clinicId: user.clinicId, status: "booked" }, include: { patient: true } })
      : null,
  ]);
  if (rescheduleId && !reschedule) notFound();

  const pid = reschedule?.patientId ?? patientId;
  const patient = pid
    ? await prisma.patient.findFirst({
        where: { id: pid, clinicId: user.clinicId },
        include: { visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { doctorId: true } } },
      })
    : null;

  return (
    <div>
      <PageHeader
        icon={CalendarPlus}
        title={reschedule ? "Reschedule appointment" : "Book appointment"}
        description="Patient → doctor → slot → confirm. Taken slots can't be picked."
      />
      <BookingWizard
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
          department: d.department?.name ?? null,
          room: d.room,
          slotMinutes: d.slotMinutes,
        }))}
        todayStr={dayRange(tz).day}
        initialPatient={patient ? toPicked(patient, patient.visits[0]?.doctorId ?? null) : null}
        initialDoctorId={reschedule?.doctorId ?? doctorParam}
        reschedule={reschedule ? { id: reschedule.id, when: fmt(reschedule.startAt, tz, "EEE d MMM, h:mm a") } : null}
      />
    </div>
  );
}
