import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyId } from "@/lib/links";

/**
 * Patient-facing prescription PDF, opened from the WhatsApp message. No login:
 * the HMAC signature in ?s= is the credential (see lib/links.ts).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/rx/[id]">) {
  const { id } = await ctx.params;
  if (!verifyId("rx", id, req.nextUrl.searchParams.get("s"))) return new Response("Link is invalid or has expired.", { status: 404 });
  const visit = await prisma.visit.findUnique({
    where: { id },
    select: { prescriptionPdf: true, completedAt: true, patient: { select: { uhid: true } } },
  });
  if (!visit?.prescriptionPdf) return new Response("Prescription not found.", { status: 404 });
  const name = `prescription-${visit.patient.uhid ?? "patient"}-${visit.completedAt?.toISOString().slice(0, 10) ?? ""}.pdf`;
  return new Response(new Uint8Array(visit.prescriptionPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
