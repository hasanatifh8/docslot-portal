import { KeyRound, UserRound } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import { Card, CardBody, CardHeader, CardTitle, KeyValue, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader icon={UserRound} title="My account" description="Your sign-in details" />
      <Card>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KeyValue label="Name" value={user.name} />
            <KeyValue label="Email" value={user.email} />
            <KeyValue label="Role" value={isRole(user.role) ? ROLE_LABELS[user.role] : user.role} />
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle icon={KeyRound}>Change password</CardTitle>
        </CardHeader>
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
