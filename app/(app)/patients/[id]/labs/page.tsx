import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FlaskConical } from "lucide-react";
import { BarChart3 } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { patientMeta } from "@/lib/patients";
import { isAbnormal, panelLabel } from "@/lib/labs";
import { patientReports, patientTrends } from "@/lib/lab-queries";
import { readerConfigured } from "@/lib/lab-reader";
import { Banner, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, chipClass, cn } from "@/components/ui";
import { FlagChip, ReportStatus, Sparkline } from "@/components/lab-ui";
import { LabProcessingWatcher, LabUpload } from "@/components/lab-upload";

/** All of a patient's lab reports, and every result organised by panel with trends. */
export default async function PatientLabsPage({ params, searchParams }: PageProps<"/patients/[id]/labs">) {
  const user = await requirePermission("labs.view");
  const tz = user.clinic.timezone;
  const { id } = await params;
  const sp = await searchParams;
  const abnormalOnly = sp.view === "abnormal";
  const patient = await prisma.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) notFound();

  const [reports, trends] = await Promise.all([patientReports(user.clinicId, id), patientTrends(id)]);
  const shown = abnormalOnly ? trends.filter((t) => isAbnormal(t.points[0].flag)) : trends;
  const panels = [...new Set(shown.map((t) => t.panel))];
  // Columns: the most recent report dates (up to 5).
  const dates = [...new Set(trends.flatMap((t) => t.points.map((p) => (p.date ? fmt(p.date, "UTC", "yyyy-MM-dd") : ""))))].filter(Boolean).sort().reverse().slice(0, 5);
  const abnormalCount = trends.filter((t) => isAbnormal(t.points[0].flag)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FlaskConical}
        title={`Lab reports · ${patient.name}`}
        description={[patient.uhid, patientMeta(patient)].filter(Boolean).join(" · ")}
        actions={
          <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-brand-700 hover:underline">
            ← Patient profile
          </Link>
        }
      />
      {!readerConfigured() && (
        <Banner tone="warn" title="AI reader not connected">
          Reports can be uploaded and viewed, but results won&apos;t be extracted until <code>ANTHROPIC_API_KEY</code> is set on the server.
        </Banner>
      )}
      <LabProcessingWatcher active={reports.some((r) => r.status === "processing")} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle icon={BarChart3}>All results, by panel</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                {trends.length} tests across {reports.filter((r) => r.status === "ready").length} reports · {abnormalCount} currently abnormal
              </p>
            </div>
            <div className="flex gap-1.5">
              <Link href={`/patients/${id}/labs`} className={chipClass(!abnormalOnly)}>
                All
              </Link>
              <Link href={`/patients/${id}/labs?view=abnormal`} className={chipClass(abnormalOnly)}>
                Abnormal only
              </Link>
            </div>
          </CardHeader>
          {shown.length === 0 ? (
            <EmptyState icon={FlaskConical} title={trends.length ? "Nothing abnormal in the latest results" : "No results yet"} description="Upload a report and the AI reader will organise every value here." />
          ) : (
            <CardBody className="space-y-5">
              {panels.map((panel) => (
                <section key={panel}>
                  <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{panelLabel(panel)}</h3>
                  <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80">
                        <tr className="text-left text-[11px] tracking-wide text-slate-500 uppercase">
                          <th className="px-3 py-2 font-medium">Test</th>
                          {dates.map((d) => (
                            <th key={d} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                              {fmt(new Date(`${d}T12:00:00Z`), "UTC", "d MMM yy")}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-medium">Trend</th>
                          <th className="px-3 py-2 font-medium">Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown
                          .filter((t) => t.panel === panel)
                          .map((t) => {
                            const byDate = new Map(t.points.map((p) => [p.date ? fmt(p.date, "UTC", "yyyy-MM-dd") : "", p]));
                            return (
                              <tr key={t.test} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-slate-800">{t.test}</div>
                                  <div className="text-[11px] text-slate-400">
                                    {t.unit}
                                    {t.refText && ` · ref ${t.refText}`}
                                  </div>
                                </td>
                                {dates.map((d) => {
                                  const p = byDate.get(d);
                                  return (
                                    <td key={d} className={cn("tabular px-3 py-2 text-right whitespace-nowrap", p && isAbnormal(p.flag) ? "font-bold text-amber-800" : "text-slate-700")}>
                                      {p ? (
                                        <Link href={`/patients/${id}/labs/${p.reportId}`} className="hover:underline">
                                          {p.value}
                                        </Link>
                                      ) : (
                                        <span className="text-slate-300">·</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-1">
                                  <Sparkline values={[...t.points].reverse().map((p) => p.numeric)} low={t.refLow} high={t.refHigh} />
                                </td>
                                <td className="px-3 py-2">
                                  <FlagChip flag={t.points[0].flag} />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </CardBody>
          )}
        </Card>

        <div className="space-y-5">
          {can(user.role, "labs.upload") && (
            <Card>
              <CardHeader>
                <CardTitle icon={FlaskConical}>Upload reports</CardTitle>
              </CardHeader>
              <CardBody>
                <LabUpload patientId={patient.id} compact />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Reports ({reports.length})</CardTitle>
            </CardHeader>
            {reports.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">None uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/patients/${id}/labs/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{r.title ?? r.fileName}</div>
                        <div className="truncate text-[11px] text-slate-500">
                          {[r.labName, r.collectedAt ? fmt(r.collectedAt, "UTC", "d MMM yyyy") : `uploaded ${fmt(r.createdAt, tz, "d MMM yyyy")}`].filter(Boolean).join(" · ")}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <ReportStatus status={r.status} />
                          {r.status === "ready" && (r.abnormal ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">{r.abnormal} abnormal</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">all normal</span>)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
