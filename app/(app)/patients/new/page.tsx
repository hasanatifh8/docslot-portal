import { UserRoundPlus } from "@/components/icons";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RegistrationWizard } from "@/components/registration-wizard";

export default async function NewPatientPage({ searchParams }: PageProps<"/patients/new">) {
  await requirePermission("patients.edit");
  const phone = String((await searchParams).phone ?? "");
  return (
    <div>
      <PageHeader icon={UserRoundPlus} title="Register patient" description="Five quick steps · a UHID is assigned automatically" />
      <RegistrationWizard initialPhone={phone} />
    </div>
  );
}
