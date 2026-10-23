import Link from "next/link";
import { LifeBuoy, Settings2 } from "lucide-react";
import { Building2, Hospital, IndianRupee, ListChecks, Stethoscope, UsersRound } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { openHospitalAs } from "@/app/actions/platform-hospitals";
import { setLeadStatus } from "@/app/actions/leads";
import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, IconChip, PageHeader, buttonClass } from "@/components/ui";
import { CreateHospitalForm } from "@/components/hospital-forms";
import { AdminShell } from "@/components/admin-shell";
import { rupees } from "@/lib/money";

function ago(d: Date | null | undefined) {
  if (!d) return "never";
  const m = Math.round((new Date().getTime() - d.getTime()) / 60_000);
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const since = new Date(new Date().getTime() - 30 * 86400_000);

  const [hospitals, visits30, money30, lastActive, leads, patientsTotal] = await Promise.all([
    prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: { where: { role: "admin" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, active: true } },
        _count: { select: { users: true, doctors: true, patients: true } },
      },
    }),
    prisma.visit.groupBy({ by: ["clinicId"], where: { status: "COMPLETED", checkedInAt: { gte: since } }, _count: true }),
    prisma.invoice.groupBy({ by: ["clinicId"], where: { status: { not: "void" }, createdAt: { gte: since } }, _sum: { paid: true } }),
    prisma.auditLog.groupBy({ by: ["clinicId"], _max: { createdAt: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.patient.count(),
  ]);
  const v = (id: string) => visits30.find((x) => x.clinicId === id)?._count ?? 0;
  const c = (id: string) => money30.find((x) => x.clinicId === id)?._sum.paid ?? 0;
  const last = (id: string) => lastActive.find((x) => x.clinicId === id)?._max.createdAt ?? null;
  const active = hospitals.filter((h) => h.active).length;

  return (
    <AdminShell>
      <PageHeader icon={Building2} title="Platform console" description="Every hospital on this DocSlot installation" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Hospitals", value: String(hospitals.length), sub: `${active} active · ${hospitals.length - active} suspended`, icon: Hospital, tone: "brand" as const },
          { label: "Patients on platform", value: patientsTotal.toLocaleString("en-IN"), sub: "all hospitals", icon: UsersRound, tone: "sky" as const },
          { label: "Visits · last 30 days", value: visits30.reduce((s, x) => s + x._count, 0).toLocaleString("en-IN"), sub: "completed consultations", icon: Stethoscope, tone: "rose" as const },
          { label: "Collected · last 30 days", value: rupees(money30.reduce((s, x) => s + (x._sum.paid ?? 0), 0)), sub: "across hospitals", icon: IndianRupee, tone: "emerald" as const },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <IconChip icon={k.icon} tone={k.tone} />
            </div>
            <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{k.value}</div>
            <div className="text-[11px] text-slate-400">{k.sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle icon={ListChecks}>Hospitals ({hospitals.length})</CardTitle>
          <CardDescription>Manage details and staff, reset passwords, or open a hospital in support mode to see exactly what its staff see.</CardDescription>
        </CardHeader>
        <ul className="divide-y divide-slate-100">
          {hospitals.map((h) => {
            const admin = h.users.find((u) => u.active) ?? h.users[0];
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    <Link href={`/admin/hospitals/${h.id}`} className="hover:text-brand-700">
                      {h.name}
                    </Link>
                    <Badge tone="slate" className="normal-case">
                      {h.code}
                    </Badge>
                    {!h.active && <Badge tone="red">suspended</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    Admin: {h.users.map((u) => u.email).join(", ") || "none"} · last activity {ago(last(h.id))}
                  </div>
                </div>
                <div className="tabular grid grid-cols-3 gap-4 text-right text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{h._count.patients.toLocaleString("en-IN")}</div>
                    <div className="text-slate-400">patients</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{v(h.id).toLocaleString("en-IN")}</div>
                    <div className="text-slate-400">visits 30d</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{rupees(c(h.id))}</div>
                    <div className="text-slate-400">collected 30d</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Link href={`/admin/hospitals/${h.id}`} className={buttonClass("secondary", "sm")}>
                    <Settings2 className="h-3.5 w-3.5" /> Manage
                  </Link>
                  {admin && (
                    <form action={openHospitalAs}>
                      <input type="hidden" name="userId" value={admin.id} />
                      <button className={buttonClass("primary", "sm")} title={`Open as ${admin.email}`}>
                        <LifeBuoy className="h-3.5 w-3.5" /> Open
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={Hospital}>Create a hospital</CardTitle>
          <CardDescription>
            Sets up a new hospital and its first administrator. They sign in at the normal login page with the temporary password and choose their own.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <CreateHospitalForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={ListChecks}>Demo requests from the website ({leads.filter((l) => l.status === "new").length} new)</CardTitle>
        </CardHeader>
        {leads.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No demo requests yet. They appear here when visitors use “Book a demo” on the homepage.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1 basis-60">
                  <div className="text-sm font-medium text-slate-900">
                    {l.name} · {l.hospital}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {[l.phone, l.email, l.city, l.size].filter(Boolean).join(" · ")}
                    {l.message && ` — ${l.message}`}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{l.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                <form action={setLeadStatus} className="flex gap-1">
                  <input type="hidden" name="id" value={l.id} />
                  {["new", "contacted", "won", "lost"].map((st) => (
                    <button
                      key={st}
                      name="status"
                      value={st}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${l.status === st ? "bg-brand-600 text-white ring-brand-600" : "text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                    >
                      {st}
                    </button>
                  ))}
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  );
}
