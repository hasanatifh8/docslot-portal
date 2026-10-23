import { after, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { ACCEPTED_TYPES, MAX_FILE_BYTES, processLabReport } from "@/lib/lab-reader";

// Reading a long report can take a couple of minutes; it runs after the response.
export const maxDuration = 300;

/** Upload one or more lab / diagnostic reports for a patient (multipart "files"). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/patients/[id]/lab-reports">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "labs.upload")) return Response.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  const patient = await prisma.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return Response.json({ error: "Patient not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "Choose at least one file" }, { status: 400 });
  if (files.length > 10) return Response.json({ error: "Upload up to 10 files at a time" }, { status: 400 });

  const created: { id: string; fileName: string }[] = [];
  const rejected: { fileName: string; reason: string }[] = [];
  for (const f of files) {
    const type = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) {
      rejected.push({ fileName: f.name, reason: "Only PDF, JPG, PNG or WebP files" });
      continue;
    }
    if (f.size > MAX_FILE_BYTES) {
      rejected.push({ fileName: f.name, reason: "File is larger than 30 MB" });
      continue;
    }
    const report = await prisma.labReport.create({
      data: {
        clinicId: user.clinicId,
        patientId: patient.id,
        uploadedById: user.id,
        fileName: f.name.slice(0, 200),
        mimeType: type,
        sizeBytes: f.size,
        file: Buffer.from(await f.arrayBuffer()),
      },
      select: { id: true, fileName: true },
    });
    created.push(report);
  }
  if (created.length) {
    await audit(user, "lab.upload", { entity: "patient", id: patient.id }, `Uploaded ${created.length} report(s) for ${patient.name} (${patient.uhid}): ${created.map((c) => c.fileName).join(", ")}`);
    // Read them after responding, one at a time.
    after(async () => {
      for (const r of created) await processLabReport(r.id);
    });
  }
  return Response.json({ created, rejected });
}
