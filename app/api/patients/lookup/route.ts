import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ageFrom } from "@/lib/patients";

/**
 * Registration step 1 + duplicate guard.
 *   ?phone=…            → everyone already registered on that number (family)
 *   ?name=…&dob=…       → likely duplicates of the person being registered
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "patients.view")) return Response.json({ family: [], duplicates: [] }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const phone = (sp.get("phone") ?? "").replace(/\D/g, "");
  const name = (sp.get("name") ?? "").trim();
  const dob = sp.get("dob");

  const shape = (p: { id: string; name: string | null; uhid: string | null; waPhone: string; gender: string | null; dob: Date | null; relation: string | null }) => ({
    id: p.id,
    name: p.name,
    uhid: p.uhid,
    waPhone: p.waPhone,
    gender: p.gender,
    age: ageFrom(p.dob),
    relation: p.relation,
  });

  const family =
    phone.length >= 10
      ? await prisma.patient.findMany({ where: { clinicId: user.clinicId, waPhone: phone }, orderBy: { createdAt: "asc" } })
      : [];

  let duplicates: typeof family = [];
  if (name.length >= 3) {
    const first = name.split(/\s+/)[0];
    duplicates = await prisma.patient.findMany({
      where: {
        clinicId: user.clinicId,
        name: { contains: first, mode: "insensitive" },
        OR: [
          ...(phone.length >= 10 ? [{ waPhone: phone }] : []),
          ...(dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? [{ dob: new Date(`${dob}T00:00:00Z`) }] : []),
        ],
      },
      take: 5,
    });
    // Same name on the same number (or same date of birth) is almost always the same person.
    const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
    duplicates = duplicates.filter((d) => norm(d.name).includes(norm(first)));
  }

  return Response.json({ family: family.map(shape), duplicates: duplicates.map(shape) });
}
