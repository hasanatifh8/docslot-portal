import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FlaskConical, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { isAbnormal, type LabInsights } from "@/lib/labs";
import { deleteReport, rereadReport } from "@/app/actions/labs";
import { Banner, Button, Card, CardBody, CardHeader, CardTitle, PageHeader, buttonClass, chipClass } from "@/components/ui";
import { InsightsCard, ReportStatus, ResultsByPanel, type ResultRow } from "@/components/lab-ui";
import { LabProcessingWatcher } from "@/components/lab-upload";

// "Read again" runs the AI reader in the background after the action responds.
export const maxDuration = 300;

/** One report: AI summary first, sorted results with previous values, original alongside. */
export default async function LabReportPage({ params, searchParams }: PageProps<"/patients/[id]/labs/[reportId]">) {
  const user = await requirePermission("labs.view");
  const tz = user.clinic.timezone;
  const { id, reportId } = await params;
  const abnormalOnly = (await searchParams).view === "abnormal";
  const report = await prisma.labReport.findFirst({
    where: { id: reportId, patientId: id, clinicId: user.clinicId },
    omit: { file: true },
    include: { patient: true, uploadedBy: { select: { name: true } }, results: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report) notFound();

  // Previous value of each test from earlier reports (by collection date).
  const earlier = await prisma.labResult.findMany({
    where: {
      patientId: id,
      reportId: { not: report.id },
      report: { status: "ready" },
      ...(report.collectedAt ? { takenAt: { lt: report.collectedAt } } : {}),
    },
    orderBy: { takenAt: "desc" },
    select: { test: true, value: true, numeric: true, takenAt: true },
  });
  const prev = new Map<string, (typeof earlier)[number]>();
  for (const e of earlier) if (!prev.has(e.test.toLowerCase())) prev.set(e.test.toLowerCase(), e);

  const rows: ResultRow[] = report.results
    .filter((r) => !abnormalOnly || isAbnormal(r.flag))
    .map((r) => {
      const p = prev.get(r.test.toLowerCase());
      return { ...r, previous: p ? { value: p.value, numeric: p.numeric, date: p.takenAt ? fmt(p.takenAt, "UTC", "d MMM yy") : "earlier" } : null };
    });
  const abnormal = report.results.filter((r) => isAbnormal(r.flag)).length;
  const fileHref = `/api/lab-reports/${report.id}/file`;
  const isPdf = report.mimeType === "application/pdf";

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FlaskConical}
        title={report.title ?? report.fileName}
        description={[
          report.patient.name,
          report.labName,
          report.collectedAt && `collected ${fmt(report.collectedAt, "UTC", "d MMM yyyy")}`,
          `uploaded ${fmt(report.createdAt, tz, "d MMM, h:mm a")}${report.uploadedBy ? ` by ${report.uploadedBy.name}` : ""}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatus status={report.status} />
            <a href={fileHref} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
              Open original
            </a>
            <a href={`${fileHref}?download`} className={buttonClass("ghost", "sm")} aria-label="Download original">
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        }
      />
      <Link href={`/patients/${id}/labs`} className="inline-block text-sm font-medium text-brand-700 hover:underline">
        ← All reports & trends
      </Link>

      <LabProcessingWatcher active={report.status === "processing"} />
      {(report.status === "failed" || report.status === "unreadable") && (
        <Banner
          tone={report.status === "failed" ? "danger" : "warn"}
          title={report.status === "failed" ? "The AI reader couldn't read this report" : "Results not extracted"}
          action={
            can(user.role, "labs.upload") && (
              <form action={rereadReport}>
                <input type="hidden" name="id" value={report.id} />
                <Button size="sm" variant="secondary">
                  <RotateCcw className="h-3.5 w-3.5" /> Read again
                </Button>
              </form>
            )
          }
        >
          {report.error}
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {report.status === "ready" && report.insights && (
            <Card>
              <CardBody>
                <InsightsCard insights={report.insights as unknown as LabInsights} model={report.model} />
              </CardBody>
            </Card>
          )}
          {report.results.length > 0 && (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle icon={FlaskConical}>Results</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {report.results.length} tests · {abnormal} outside range · grouped in clinical order
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Link href={`/patients/${id}/labs/${report.id}`} className={chipClass(!abnormalOnly)}>
                    All
                  </Link>
                  <Link href={`/patients/${id}/labs/${report.id}?view=abnormal`} className={chipClass(abnormalOnly)}>
                    Abnormal only ({abnormal})
                  </Link>
                </div>
              </CardHeader>
              <CardBody>
                <ResultsByPanel rows={rows} fileHref={isPdf ? fileHref : undefined} />
              </CardBody>
            </Card>
          )}
        </div>
        <Card className="overflow-hidden xl:sticky xl:top-20 xl:self-start">
          <CardHeader>
            <CardTitle>Original report</CardTitle>
          </CardHeader>
          {isPdf ? (
            <iframe src={fileHref} title="Original report" className="h-[75vh] w-full border-0 bg-slate-100" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileHref} alt="Original report" className="w-full" />
          )}
        </Card>
      </div>

      {can(user.role, "labs.delete") && (
        <form action={deleteReport} className="flex justify-end">
          <input type="hidden" name="id" value={report.id} />
          <Button variant="danger" size="sm">
            <Trash2 className="h-3.5 w-3.5" /> Delete this report
          </Button>
        </form>
      )}
    </div>
  );
}
