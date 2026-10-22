import Link from "next/link";
import { BarChart3, CalendarCheck2, Clock, Download, IndianRupee, Stethoscope, UserRoundPlus, UsersRound } from "@/components/icons";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { rupees } from "@/lib/money";
import { PRESETS, avg, mins, reportWindow } from "@/lib/reports";
import { Card, CardHeader, CardTitle, EmptyState, IconChip, PageHeader, buttonClass, chipClass, cn } from "@/components/ui";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePermission("reports.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const w = reportWindow(tz, { range: sp.range as string, from: sp.from as string, to: sp.to as string });
  const inRange = { gte: w.start, lt: w.end };

  const [visits, appts, payments, invoices, doctors, newPatients] = await Promise.all([
    prisma.visit.findMany({
      where: { clinicId: user.clinicId, checkedInAt: inRange },
      select: {
        id: true,
        status: true,
        visitType: true,
        doctorId: true,
        checkedInAt: true,
        triageCompletedAt: true,
        consultStartedAt: true,
        completedAt: true,
        diagnosis: true,
        icdCode: true,
      },
    }),
    prisma.appointment.findMany({ where: { clinicId: user.clinicId, startAt: inRange }, select: { status: true, source: true } }),
    prisma.payment.findMany({
      where: { invoice: { clinicId: user.clinicId }, createdAt: inRange },
      select: { kind: true, amount: true, mode: true, invoice: { select: { visit: { select: { doctorId: true } } } } },
    }),
    prisma.invoice.findMany({ where: { clinicId: user.clinicId, createdAt: inRange, status: { not: "void" } }, select: { total: true, paid: true } }),
    prisma.doctor.findMany({ where: { clinicId: user.clinicId }, include: { department: true }, orderBy: { name: "asc" } }),
    prisma.patient.count({ where: { clinicId: user.clinicId, createdAt: inRange } }),
  ]);

  const done = visits.filter((v) => v.status === "COMPLETED");
  const net = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
  const collected = payments.reduce((s, p) => s + net(p), 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
  const waitToDoctor = avg(done.map((v) => mins(v.checkedInAt, v.consultStartedAt)).filter((x): x is number => x != null));
  const consultTime = avg(done.map((v) => mins(v.consultStartedAt, v.completedAt)).filter((x): x is number => x != null));
  const noShow = appts.filter((a) => a.status === "no_show").length;
  const attended = appts.filter((a) => a.status === "completed").length;
  const noShowRate = noShow + attended ? Math.round((noShow / (noShow + attended)) * 100) : null;
  const whatsappShare = appts.length ? Math.round((appts.filter((a) => a.source === "whatsapp").length / appts.length) * 100) : null;

  const perDay = w.days.map((d) => ({ day: d, count: done.filter((v) => formatInTimeZone(v.checkedInAt, tz, "yyyy-MM-dd") === d).length }));
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));

  const byDoctor = doctors
    .map((d) => {
      const mine = done.filter((v) => v.doctorId === d.id);
      return {
        d,
        visits: mine.length,
        fresh: mine.filter((v) => v.visitType === "new").length,
        follow: mine.filter((v) => v.visitType === "follow_up").length,
        wait: avg(mine.map((v) => mins(v.checkedInAt, v.consultStartedAt)).filter((x): x is number => x != null)),
        consult: avg(mine.map((v) => mins(v.consultStartedAt, v.completedAt)).filter((x): x is number => x != null)),
        revenue: payments.filter((p) => p.invoice.visit?.doctorId === d.id).reduce((s, p) => s + net(p), 0),
      };
    })
    .filter((r) => r.visits || r.revenue);

  const depts = [...new Set(doctors.map((d) => d.department?.name ?? "No department"))].map((name) => {
    const rows = byDoctor.filter((r) => (r.d.department?.name ?? "No department") === name);
    return { name, visits: rows.reduce((s, r) => s + r.visits, 0), revenue: rows.reduce((s, r) => s + r.revenue, 0) };
  }).filter((d) => d.visits || d.revenue);

  const dx = new Map<string, { label: string; n: number }>();
  for (const v of done) {
    if (!v.diagnosis) continue;
    const key = v.icdCode ?? v.diagnosis.toLowerCase();
    const cur = dx.get(key) ?? { label: v.icdCode ? `${v.diagnosis} (${v.icdCode})` : v.diagnosis, n: 0 };
    cur.n++;
    dx.set(key, cur);
  }
  const topDx = [...dx.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  const q = (o: Record<string, string>) => `/reports?${new URLSearchParams(o)}`;
  const exportQ = `from=${w.from}&to=${w.to}`;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Reports"
        description={w.from === w.to ? fmt(w.start, tz, "EEEE, d MMMM yyyy") : `${fmt(w.start, tz, "d MMM")} – ${fmt(new Date(w.end.getTime() - 1), tz, "d MMM yyyy")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/reports/export?type=visits&${exportQ}`} className={buttonClass("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" /> Visits CSV
            </a>
            <a href={`/api/reports/export?type=payments&${exportQ}`} className={buttonClass("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" /> Payments CSV
            </a>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link key={p.value} href={q({ range: p.value })} className={chipClass(w.range === p.value)}>
            {p.label}
          </Link>
        ))}
        <form className="flex items-center gap-1.5 sm:ml-auto">
          <input type="date" name="from" defaultValue={w.from} className="h-8 rounded-lg border border-slate-300 px-2 text-xs" aria-label="From" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" name="to" defaultValue={w.to} className="h-8 rounded-lg border border-slate-300 px-2 text-xs" aria-label="To" />
          <button className={buttonClass("secondary", "sm")}>Apply</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Stethoscope} tone="brand" label="Patients seen" value={String(done.length)} sub={`${done.filter((v) => v.visitType === "new").length} new · ${done.filter((v) => v.visitType === "follow_up").length} follow-up`} />
        <Kpi icon={IndianRupee} tone="emerald" label="Collected (net)" value={rupees(collected)} sub={`${rupees(outstanding)} outstanding`} />
        <Kpi icon={Clock} tone="amber" label="Avg wait to doctor" value={waitToDoctor != null ? `${waitToDoctor} min` : "—"} sub={consultTime != null ? `Consult ${consultTime} min avg` : undefined} />
        <Kpi
          icon={CalendarCheck2}
          tone="violet"
          label="No-show rate"
          value={noShowRate != null ? `${noShowRate}%` : "—"}
          sub={`${appts.length} booked${whatsappShare != null ? ` · ${whatsappShare}% via WhatsApp` : ""}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle icon={BarChart3}>Patients seen per day</CardTitle>
            <span className="text-xs text-slate-400">{newPatients} new registrations</span>
          </CardHeader>
          {done.length === 0 ? (
            <EmptyState title="No completed visits in this period" />
          ) : (
            <div className="p-5">
              <div className="flex h-44 items-end gap-[2px] border-b border-slate-200" role="img" aria-label="Completed visits per day">
                {perDay.map((d) => (
                  <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-10 rounded-t-[4px] bg-brand-500 transition-colors group-hover:bg-brand-700"
                      style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 4 : 0 }}
                    />
                    <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded-lg bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">
                      {fmt(new Date(`${d.day}T12:00:00Z`), "UTC", "EEE d MMM")}: {d.count} seen
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-[2px] text-[10px] text-slate-400">
                {perDay.map((d, i) => (
                  <div key={d.day} className="flex-1 text-center">
                    {perDay.length <= 10 || i % Math.ceil(perDay.length / 8) === 0 ? fmt(new Date(`${d.day}T12:00:00Z`), "UTC", perDay.length <= 10 ? "EEE d" : "d MMM") : ""}
                  </div>
                ))}
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-slate-500">Show as table</summary>
                <table className="mt-2 w-full">
                  <tbody>
                    {perDay.map((d) => (
                      <tr key={d.day} className="border-t border-slate-100">
                        <td className="py-1 text-slate-600">{d.day}</td>
                        <td className="tabular py-1 text-right font-medium">{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={UsersRound}>Top diagnoses</CardTitle>
          </CardHeader>
          {topDx.length === 0 ? (
            <EmptyState title="No diagnoses recorded" />
          ) : (
            <ul className="space-y-2.5 p-5">
              {topDx.map((d) => (
                <li key={d.label}>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{d.label}</span>
                    <span className="tabular font-semibold text-slate-900">{d.n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(d.n / topDx[0].n) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle icon={Stethoscope}>By doctor</CardTitle>
        </CardHeader>
        {byDoctor.length === 0 ? (
          <EmptyState title="No activity in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-2 font-medium">Doctor</th>
                  <th className="px-3 py-2 text-right font-medium">Seen</th>
                  <th className="px-3 py-2 text-right font-medium">New</th>
                  <th className="px-3 py-2 text-right font-medium">Follow-up</th>
                  <th className="px-3 py-2 text-right font-medium">Avg wait</th>
                  <th className="px-3 py-2 text-right font-medium">Avg consult</th>
                  <th className="px-5 py-2 text-right font-medium">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byDoctor.map((r) => (
                  <tr key={r.d.id}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-900">{r.d.name}</div>
                      <div className="text-xs text-slate-500">{r.d.department?.name ?? r.d.specialty}</div>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-semibold">{r.visits}</td>
                    <td className="tabular px-3 py-2.5 text-right text-slate-600">{r.fresh}</td>
                    <td className="tabular px-3 py-2.5 text-right text-slate-600">{r.follow}</td>
                    <td className={cn("tabular px-3 py-2.5 text-right", (r.wait ?? 0) > 45 ? "font-semibold text-rose-600" : "text-slate-600")}>{r.wait != null ? `${r.wait} min` : "—"}</td>
                    <td className="tabular px-3 py-2.5 text-right text-slate-600">{r.consult != null ? `${r.consult} min` : "—"}</td>
                    <td className="tabular px-5 py-2.5 text-right font-medium">{rupees(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {depts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle icon={UserRoundPlus}>By department</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100 text-sm">
            {depts.map((d) => (
              <li key={d.name} className="flex justify-between gap-3 px-5 py-2.5">
                <span className="font-medium text-slate-800">{d.name}</span>
                <span className="tabular text-slate-600">
                  {d.visits} seen · <span className="font-medium text-slate-900">{rupees(d.revenue)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub }: { icon: typeof Clock; tone: "brand" | "emerald" | "amber" | "violet"; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <IconChip icon={icon} tone={tone} />
      </div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
    </Card>
  );
}
