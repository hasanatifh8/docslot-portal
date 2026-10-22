import Link from "next/link";
import { CalendarCheck2, CalendarPlus, CalendarSync } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dayRange, fmt } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, buttonClass, chipClass, cn } from "@/components/ui";
import { PatientAvatar } from "@/components/patient-avatar";
import { FollowUpActions } from "@/components/followup-actions";

const TABS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Next 7 days" },
  { value: "booked", label: "Already booked" },
] as const;

/** Patients the doctor asked to come back — so nobody falls through the cracks. */
export default async function FollowUpsPage({ searchParams }: PageProps<"/follow-ups">) {
  const user = await requirePermission("followups.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.value === sp.tab)?.value ?? "overdue") as (typeof TABS)[number]["value"];
  const today = new Date(`${dayRange(tz).day}T00:00:00Z`);
  const mine = user.role === "doctor" && user.doctorId ? { doctorId: user.doctorId } : {};

  const visits = await prisma.visit.findMany({
    where: {
      clinicId: user.clinicId,
      status: "COMPLETED",
      followUpClosedAt: null,
      followUpDate: { gte: new Date(today.getTime() - 60 * 86400_000), lt: new Date(today.getTime() + 8 * 86400_000) },
      ...mine,
    },
    orderBy: { followUpDate: "asc" },
    omit: { prescriptionPdf: true },
    include: {
      doctor: { select: { id: true, name: true } },
      patient: {
        include: {
          appointments: { where: { status: { in: ["booked", "completed"] } }, select: { startAt: true, createdAt: true, doctorId: true } },
          visits: { select: { checkedInAt: true }, orderBy: { checkedInAt: "desc" }, take: 1 },
        },
      },
    },
  });

  // A follow-up is "booked" once a later appointment or visit exists.
  const rows = visits.map((v) => {
    const after = v.completedAt ?? v.checkedInAt;
    const appt = v.patient.appointments.find((a) => a.createdAt > after || a.startAt > after);
    const revisited = v.patient.visits[0] && v.patient.visits[0].checkedInAt > after;
    return { v, booked: appt ? fmt(appt.startAt, tz, "d MMM, h:mm a") : revisited ? "visited" : null };
  });
  const day = (d: Date) => d.getTime();
  const groups = {
    overdue: rows.filter((r) => !r.booked && day(r.v.followUpDate!) < day(today)),
    today: rows.filter((r) => !r.booked && day(r.v.followUpDate!) === day(today)),
    week: rows.filter((r) => !r.booked && day(r.v.followUpDate!) > day(today)),
    booked: rows.filter((r) => r.booked),
  };
  const shown = groups[tab];
  const canBook = can(user.role, "appointments.manage");

  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarSync} title="Follow-ups" description="Patients advised to return. Remind them on WhatsApp or book in one click." />
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.value} href={`/follow-ups?tab=${t.value}`} className={chipClass(tab === t.value)}>
            {t.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", tab === t.value ? "bg-white/20" : t.value === "overdue" && groups.overdue.length ? "bg-rose-100 text-rose-700" : "bg-slate-100")}>
              {groups[t.value].length}
            </span>
          </Link>
        ))}
      </div>
      <Card>
        {shown.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title={tab === "overdue" ? "No overdue follow-ups" : "Nothing here"} description="Follow-up dates set by doctors at the end of a consultation show up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map(({ v, booked }) => {
              const overdueDays = Math.round((day(today) - day(v.followUpDate!)) / 86400_000);
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <PatientAvatar name={v.patient.name} gender={v.patient.gender} className="h-9 w-9" />
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={`/patients/${v.patient.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {v.patient.name} <span className="font-normal text-slate-400">· {v.patient.uhid}</span>
                    </Link>
                    <div className="truncate text-xs text-slate-500">
                      {v.doctor.name} · seen {fmt(v.checkedInAt, tz, "d MMM")} · {v.diagnosis ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{fmt(v.followUpDate!, "UTC", "EEE, d MMM")}</div>
                    {booked ? (
                      <Badge tone="green" className="normal-case">
                        Booked {booked}
                      </Badge>
                    ) : overdueDays > 0 ? (
                      <span className="text-xs font-medium text-rose-600">{overdueDays} day{overdueDays === 1 ? "" : "s"} overdue</span>
                    ) : v.followUpRemindedAt ? (
                      <span className="text-xs text-emerald-700">Reminded {fmt(v.followUpRemindedAt, tz, "d MMM")}</span>
                    ) : null}
                  </div>
                  {!booked && (
                    <div className="flex w-full flex-wrap justify-end gap-1.5 sm:w-auto">
                      {canBook && (
                        <Link href={`/appointments/new?patient=${v.patient.id}&doctor=${v.doctor.id}`} className={buttonClass("primary", "sm")}>
                          <CalendarPlus className="h-3.5 w-3.5" /> Book
                        </Link>
                      )}
                      <FollowUpActions visitId={v.id} reminded={!!v.followUpRemindedAt} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
