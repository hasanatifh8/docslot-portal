import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ageFrom } from "@/lib/patients";

/** Live patient search for pickers and the Ctrl+K palette. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "patients.view")) return Response.json([], { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  const digits = q.replace(/\D/g, "");

  const rows = await prisma.patient.findMany({
    where: {
      clinicId: user.clinicId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { uhid: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ waPhone: { contains: digits } }] : []),
      ],
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { doctorId: true, checkedInAt: true } },
    },
  });

  return Response.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      uhid: p.uhid,
      waPhone: p.waPhone,
      gender: p.gender,
      age: ageFrom(p.dob),
      relation: p.relation,
      allergies: p.allergies,
      lastDoctorId: p.visits[0]?.doctorId ?? null,
      lastVisitAt: p.visits[0]?.checkedInAt ?? null,
    }))
  );
}
