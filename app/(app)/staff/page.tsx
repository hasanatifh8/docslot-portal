import { BadgePlus, IdCard, UserRoundCog } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import { toggleStaffActive } from "@/app/actions/staff";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { AddStaffForm, ResetPasswordForm, RoleForm } from "@/components/staff-forms";

export default async function StaffPage() {
  const admin = await requirePermission("staff.manage");

  const [users, doctorRows] = await Promise.all([
    prisma.user.findMany({
      where: { clinicId: admin.clinicId },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: { doctor: true },
    }),
    prisma.doctor.findMany({
      where: { clinicId: admin.clinicId },
      orderBy: { name: "asc" },
      include: { user: { select: { id: true } } },
    }),
  ]);
  const doctors = doctorRows.map((d) => ({ id: d.id, name: d.name, linked: !!d.user }));

  return (
    <div className="space-y-6">
      <PageHeader icon={UserRoundCog} title="Staff" description="Who can sign in, and what they can do" />

      <Card>
        <CardHeader>
          <CardTitle icon={BadgePlus}>Add a staff member</CardTitle>
          <CardDescription>
            OPD runs check-in → triage → consultation. Receptionists register, book and check patients in. Junior
            doctors and nurses run triage (vitals). Senior doctors consult and finalize prescriptions for their own
            patients. Administrators can do everything.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <AddStaffForm doctors={doctors} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={IdCard}>Care team</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => {
            const self = u.id === admin.id;
            return (
              <li key={u.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {u.name}
                      {self && <Badge tone="brand">you</Badge>}
                      {!u.active && <Badge tone="red">deactivated</Badge>}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {u.email} · {isRole(u.role) ? ROLE_LABELS[u.role] : u.role}
                      {u.doctor && ` · ${u.doctor.name}`}
                    </div>
                  </div>
                  {!self && (
                    <form action={toggleStaffActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <Button variant={u.active ? "danger" : "secondary"} size="sm">
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                  )}
                </div>
                {!self && u.active && (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <RoleForm userId={u.id} role={u.role} doctorId={u.doctorId} doctors={doctors} />
                    <ResetPasswordForm userId={u.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
