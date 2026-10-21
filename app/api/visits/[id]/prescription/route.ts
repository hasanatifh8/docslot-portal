import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

/** Serves the prescription PDF frozen when the visit was completed. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/visits/[id]/prescription">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can(user.role, "opd.view")) return new Response("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const visit = await prisma.visit.findFirst({
    where: { id, clinicId: user.clinicId },
    select: { prescriptionPdf: true, token: true, completedAt: true, patient: { select: { uhid: true } } },
  });
  if (!visit?.prescriptionPdf) return new Response("No finalized prescription for this visit", { status: 404 });

  const name = `prescription-${visit.patient.uhid ?? "patient"}-${visit.completedAt?.toISOString().slice(0, 10) ?? ""}.pdf`;
  const disposition = req.nextUrl.searchParams.has("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(visit.prescriptionPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
