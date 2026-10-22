import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { Card, EmptyState, Input, PageHeader, buttonClass, chipClass } from "@/components/ui";

const ENTITIES = [
  { value: "all", label: "Everything" },
  { value: "patient", label: "Patients" },
  { value: "visit", label: "Visits & Rx" },
  { value: "appointment", label: "Appointments" },
  { value: "invoice", label: "Billing" },
  { value: "user", label: "Staff & logins" },
];
const PAGE = 50;

/** Read-only trail of every change: who, what, when. Rows can't be edited or deleted from the app. */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const user = await requirePermission("audit.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" ? sp.entity : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    clinicId: user.clinicId,
    ...(entity !== "all" ? { entity } : {}),
    ...(q ? { OR: [{ summary: { contains: q, mode: "insensitive" as const } }, { userName: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    prisma.auditLog.count({ where }),
  ]);
  const href = (o: Record<string, string>) => `/audit?${new URLSearchParams({ entity, q, page: "1", ...o })}`;

  return (
    <div className="space-y-5">
      <PageHeader icon={ScrollText} title="Audit log" description="Every change to patients, visits, prescriptions, bills and staff — read-only" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ENTITIES.map((e) => (
            <Link key={e.value} href={href({ entity: e.value })} className={chipClass(entity === e.value)}>
              {e.label}
            </Link>
          ))}
        </div>
        <form className="relative sm:ml-auto sm:w-72">
          <input type="hidden" name="entity" value={entity} />
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder="Patient, UHID, staff name…" className="h-9 pl-9" />
        </form>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No matching entries" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_10rem_1fr] sm:gap-4 sm:px-5">
                <span className="tabular text-xs text-slate-500">{fmt(r.createdAt, tz, "d MMM yyyy, h:mm a")}</span>
                <span className="truncate text-xs font-medium text-slate-700">
                  {r.userName}
                  <span className="ml-1 font-mono text-[10px] font-normal text-slate-400">{r.action}</span>
                </span>
                <span className="text-slate-800">{r.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {total > PAGE && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {(page - 1) * PAGE + 1}–{Math.min(total, page * PAGE)} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: String(page - 1) })} className={buttonClass("secondary", "sm")}>
                ← Newer
              </Link>
            )}
            {page * PAGE < total && (
              <Link href={href({ page: String(page + 1) })} className={buttonClass("secondary", "sm")}>
                Older →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
