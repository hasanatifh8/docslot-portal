import Link from "next/link";
import { Droplet, Search, UserRoundPlus, UsersRound } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";
import { Badge, Button, Card, EmptyState, Input, PageHeader, buttonClass } from "@/components/ui";
import { PatientAvatar } from "@/components/patient-avatar";

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const user = await requirePermission("patients.view");
  const tz = user.clinic.timezone;
  const q = String((await searchParams).q ?? "").trim();

  const digits = q.replace(/\D/g, "");
  const where: Prisma.PatientWhereInput = { clinicId: user.clinicId };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { uhid: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ waPhone: { contains: digits } }] : []),
    ];
  }

  const patients = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { checkedInAt: true } } },
  });

  return (
    <div>
      <PageHeader
        icon={UsersRound}
        title="Patients"
        description="Search by name, UHID or phone"
        actions={
          can(user.role, "patients.edit") && (
            <Link href="/patients/new" className={buttonClass("primary", "md")}>
              <UserRoundPlus className="h-4 w-4" />
              Register patient
            </Link>
          )
        }
      />

      <form className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder="Rahul, UH000042, 98123…" className="pl-9" />
        </div>
        <Button variant="secondary">Search</Button>
      </form>

      <Card>
        {patients.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={q ? "No patients match that search" : "No patients yet"}
            description={q ? undefined : "Register a patient, or they'll appear here when they book on WhatsApp."}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-slate-50 sm:flex-nowrap sm:px-5"
                >
                  <PatientAvatar name={p.name} gender={p.gender} />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-sm font-medium text-slate-900">{p.name || "Unnamed patient"}</div>
                    <div className="truncate text-xs text-slate-500">
                      <span className="font-mono text-brand-700">{p.uhid ?? "—"}</span>
                      {" · "}
                      {[patientMeta(p), `+${p.waPhone}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {p.bloodGroup && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-600/10 ring-inset">
                        <Droplet className="h-3 w-3" />
                        {p.bloodGroup}
                      </span>
                    )}
                    {p.allergies && <Badge tone="red">allergies</Badge>}
                    {p.visits[0] ? `Last visit ${fmt(p.visits[0].checkedInAt, tz, "d MMM yyyy")}` : "No visits"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
