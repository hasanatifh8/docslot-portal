// Append-only audit trail: who changed what, and when. Write one row per
// user-visible change from server actions. Never throws — a failed audit write
// must not undo the clinical work it describes (it is logged instead).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditActor = { id: string; name: string; clinicId: string };

export async function audit(
  actor: AuditActor,
  action: string,
  target: { entity: string; id?: string | null },
  summary: string,
  db: Db = prisma
) {
  try {
    await db.auditLog.create({
      data: {
        clinicId: actor.clinicId,
        userId: actor.id,
        userName: actor.name,
        action,
        entity: target.entity,
        entityId: target.id ?? null,
        summary: summary.slice(0, 500),
      },
    });
  } catch (e) {
    console.error("[audit] write failed", action, e);
  }
}

/** "name: A → B" lines for the fields that changed, for audit summaries. */
export function diffSummary<T extends Record<string, unknown>>(before: T, after: Partial<T>, labels: Partial<Record<keyof T, string>>) {
  const show = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null || v === "" ? "—" : String(v));
  return (Object.keys(labels) as (keyof T)[])
    .filter((k) => k in after && show(before[k]) !== show(after[k]))
    .map((k) => `${labels[k]}: ${show(before[k])} → ${show(after[k])}`)
    .join("; ");
}
