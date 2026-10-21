import { UserRoundPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export default async function NewPatientPage() {
  await requirePermission("patients.edit");
  return (
    <div>
      <PageHeader icon={UserRoundPlus} title="Register patient" description="A UHID is assigned automatically" />
      <Card>
        <CardBody>
          <PatientForm />
        </CardBody>
      </Card>
    </div>
  );
}
