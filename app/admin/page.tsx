import { Building2, Hospital, ListChecks, LogOut } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { platformLogoutAction } from "@/app/actions/platform";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { Logo } from "@/components/brand";
import { CreateHospitalForm } from "@/components/hospital-forms";

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();

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
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    Admin: {h.users.map((u) => u.email).join(", ") || "none"}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {h._count.users} staff · {h._count.doctors} doctors · {h._count.patients} patients
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
