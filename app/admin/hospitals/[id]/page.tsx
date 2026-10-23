import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { Hospital, IndianRupee, ScrollText, Stethoscope, UserRoundCog, UsersRound } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { openHospitalAs, setHospitalActive } from "@/app/actions/platform-hospitals";
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { rupeeInput, rupees } from "@/lib/money";
import { Badge, Banner, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, IconChip, PageHeader, buttonClass, cn } from "@/components/ui";
import { AdminShell } from "@/components/admin-shell";
import { AddUserForm, HospitalDetailsForm, UserControls } from "@/components/platform-forms";

/** Everything the platform admin can do for one hospital. */
export default async function HospitalControlPage({ params }: PageProps<"/admin/hospitals/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const since = new Date(new Date().getTime() - 30 * 86400_000);

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: {
      users: { orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }], include: { sessions: { where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 1 } } },
      _count: { select: { patients: true, doctors: true, appointments: true } },
    },
  });
  if (!clinic) notFound();
  const tz = clinic.timezone;

  const [visits30, money30, due, recent] = await Promise.all([
    prisma.visit.count({ where: { clinicId: id, status: "COMPLETED", checkedInAt: { gte: since } } }),
    prisma.invoice.aggregate({ where: { clinicId: id, status: { not: "void" }, createdAt: { gte: since } }, _sum: { paid: true } }),
    prisma.invoice.findMany({ where: { clinicId: id, status: { in: ["unpaid", "partial"] } }, select: { total: true, paid: true } }),
    prisma.auditLog.findMany({ where: { clinicId: id }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const outstanding = due.reduce((s, i) => s + i.total - i.paid, 0);

  return (
    <AdminShell>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All hospitals
      </Link>
      <PageHeader
        icon={Hospital}
        title={clinic.name}
        description={`Code ${clinic.code} · ${clinic.timezone} · on DocSlot since ${fmt(clinic.createdAt, tz, "d MMM yyyy")}`}
        actions={
          <div className="flex items-center gap-2">
            {clinic.active ? <Badge tone="green">active</Badge> : <Badge tone="red">suspended</Badge>}
          </div>
        }
      />

      {!clinic.active && (
        <Banner tone="danger" title="This hospital is suspended">
          Its staff can&apos;t sign in. You can still open it in support mode to investigate.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Patients", value: clinic._count.patients.toLocaleString("en-IN"), icon: UsersRound, tone: "sky" as const },
          { label: "Doctors", value: String(clinic._count.doctors), icon: Stethoscope, tone: "rose" as const },
          { label: "Staff logins", value: `${clinic.users.filter((u) => u.active).length} / ${clinic.users.length}`, icon: UserRoundCog, tone: "violet" as const },
          { label: "Visits · 30 days", value: visits30.toLocaleString("en-IN"), icon: Stethoscope, tone: "brand" as const },
          { label: "Collected · 30 days", value: rupees(money30._sum.paid ?? 0), icon: IndianRupee, tone: "emerald" as const, sub: `${rupees(outstanding)} outstanding` },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <IconChip icon={k.icon} tone={k.tone} />
            </div>
            <div className="tabular mt-1 truncate text-xl font-semibold text-slate-900">{k.value}</div>
            {"sub" in k && <div className="text-[11px] text-slate-400">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle icon={UserRoundCog}>Staff &amp; logins</CardTitle>
              <CardDescription>Reset passwords (a temporary one is generated and shown once), change roles, deactivate, or open the hospital as any user.</CardDescription>
            </CardHeader>
            <ul className="divide-y divide-slate-100">
              {clinic.users.map((u) => (
                <li key={u.id} className={cn("space-y-3 px-4 py-4 sm:px-5", !u.active && "bg-slate-50/70")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {u.name}
                        <Badge tone={u.role === "admin" ? "brand" : "slate"} className="normal-case">
                          {isRole(u.role) ? ROLE_LABELS[u.role] : u.role}
                        </Badge>
                        {!u.active && <Badge tone="red">deactivated</Badge>}
                        {u.mustChangePassword && <Badge tone="amber" className="normal-case">temp password</Badge>}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {u.email} · {u.sessions[0] ? `signed in ${fmt(u.sessions[0].createdAt, tz, "d MMM, h:mm a")}` : "not signed in"}
                      </div>
                    </div>
                    <form action={openHospitalAs}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className={buttonClass("primary", "sm")} title={`Open ${clinic.name} as ${u.name}`}>
                        <LifeBuoy className="h-3.5 w-3.5" /> Open as {shortName(u.name)}
                      </button>
                    </form>
                  </div>
                  <UserControls user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, mustChangePassword: u.mustChangePassword }} />
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-slate-100">
              <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Add a user</div>
              <AddUserForm clinicId={clinic.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle icon={ScrollText}>Recent activity</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-slate-100 text-sm">
              {recent.length === 0 && <li className="px-5 py-4 text-slate-400">No activity yet</li>}
              {recent.map((r) => (
                <li key={r.id} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[8.5rem_1fr] sm:px-5">
                  <span className="tabular text-xs text-slate-500">{fmt(r.createdAt, tz, "d MMM, h:mm a")}</span>
                  <span className={cn("text-slate-700", r.userName === "Platform admin" && "font-medium text-rose-700")}>
                    <span className="font-medium">{r.userName}</span> — {r.summary}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle icon={Hospital}>Hospital details</CardTitle>
            </CardHeader>
            <CardBody>
              <HospitalDetailsForm
                hospital={{
                  id: clinic.id,
                  name: clinic.name,
                  code: clinic.code,
                  phone: clinic.phone,
                  addressText: clinic.addressText,
                  timezone: clinic.timezone,
                  monthlyTarget: clinic.monthlyTarget ? rupeeInput(clinic.monthlyTarget) : "",
                }}
              />
            </CardBody>
          </Card>

          <Card className="ring-rose-200">
            <CardHeader>
              <CardTitle>Account status</CardTitle>
              <CardDescription>
                {clinic.active
                  ? "Suspending signs every user out immediately and blocks sign-in. Data is kept."
                  : "Reactivating lets staff sign in again with their existing passwords."}
              </CardDescription>
            </CardHeader>
            <CardBody>
              <form action={setHospitalActive}>
                <input type="hidden" name="id" value={clinic.id} />
                <input type="hidden" name="active" value={clinic.active ? "false" : "true"} />
                <Button variant={clinic.active ? "danger" : "success"}>{clinic.active ? "Suspend hospital" : "Reactivate hospital"}</Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

/** "Dr. Mehra" stays whole; "Ritu Kapoor" → "Ritu"; "Hospital Admin" → "Hospital Admin". */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (/^(dr|mr|mrs|ms|prof)\.?$/i.test(parts[0]) && parts[1]) return `${parts[0]} ${parts[1]}`;
  return parts.length > 1 && parts[1].length <= 6 && /^(admin|team|desk)$/i.test(parts[1]) ? name : parts[0];
}
