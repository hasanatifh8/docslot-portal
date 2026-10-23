import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

/** The original uploaded report, unchanged. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/lab-reports/[id]/file">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "labs.view")) return new Response("Not allowed", { status: 403 });
  const { id } = await ctx.params;
  const r = await prisma.labReport.findFirst({ where: { id, clinicId: user.clinicId }, select: { file: true, mimeType: true, fileName: true } });
  if (!r) return new Response("Not found", { status: 404 });
  const disposition = req.nextUrl.searchParams.has("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(r.file), {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Disposition": `${disposition}; filename="${r.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
