import { Building2, Hospital, ListChecks, LogOut } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { platformLogoutAction } from "@/app/actions/platform";
import { toggleHospital } from "@/app/actions/hospitals";
import { setLeadStatus } from "@/app/actions/leads";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { Logo } from "@/components/brand";
import { CreateHospitalForm } from "@/components/hospital-forms";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();

  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const hospitals = await prisma.clinic.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { where: { role: "admin" }, orderBy: { createdAt: "asc" }, select: { email: true } },
      _count: { select: { users: true, doctors: true, patients: true } },
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-brand-900/[0.06] bg-white px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge tone="brand">Platform admin</Badge>
        </div>
        <form action={platformLogoutAction}>
          <Button variant="secondary" size="sm">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader icon={Building2} title="Hospitals" description="Every hospital on this DocSlot installation" />

        <Card>
          <CardHeader>
            <CardTitle icon={Hospital}>Create a hospital</CardTitle>
            <CardDescription>
              Sets up a new hospital and its first administrator. The administrator signs in at the normal login page
              and adds doctors and staff from their own dashboard.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <CreateHospitalForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={ListChecks}>All hospitals ({hospitals.length})</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {hospitals.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {h.name}
                    <Badge tone="slate" className="normal-case">
                      {h.code}
                    </Badge>
                    {!h.active && <Badge tone="red">suspended</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    Admin: {h.users.map((u) => u.email).join(", ") || "none"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {h._count.users} staff · {h._count.doctors} doctors · {h._count.patients} patients
                  </span>
                  <form action={toggleHospital}>
                    <input type="hidden" name="id" value={h.id} />
                    <Button variant={h.active ? "danger" : "secondary"} size="sm">
                      {h.active ? "Suspend" : "Reactivate"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
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
      </main>
    </div>
  );
}
