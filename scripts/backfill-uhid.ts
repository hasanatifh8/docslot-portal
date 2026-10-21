/**
 * One-off: give every pre-HMS patient a UHID, in registration order.
 * Safe to re-run — patients that already have one are skipped.
 *   npx tsx scripts/backfill-uhid.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { nextUhid } from "../lib/patients";

async function main() {
  const missing = await prisma.patient.findMany({
    where: { uhid: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, clinicId: true },
  });
  for (const p of missing) {
    await prisma.patient.update({ where: { id: p.id }, data: { uhid: await nextUhid(p.clinicId) } });
  }
  console.log(`Assigned UHIDs to ${missing.length} patient(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
