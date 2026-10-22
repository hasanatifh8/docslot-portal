import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PasswordForm } from "@/components/password-form";
import { Card, CardBody } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell clinicName={user.clinic.name} userName={user.name} role={user.role} initials={initials}>
      {user.mustChangePassword ? (
        // First sign-in with a password someone else chose: replace it before anything else.
        <div className="mx-auto max-w-lg">
          <Card>
            <CardBody className="space-y-5 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Set your own password</h1>
                  <p className="text-sm text-slate-500">You signed in with a temporary password. Choose a new one to continue.</p>
                </div>
              </div>
              <PasswordForm forced />
            </CardBody>
          </Card>
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}
