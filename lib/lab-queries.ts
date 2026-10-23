// Read-side helpers for lab reports and result trends.
import { prisma } from "@/lib/db";
import { isAbnormal, panelRank } from "@/lib/labs";

export async function patientReports(clinicId: string, patientId: string) {
  const reports = await prisma.labReport.findMany({
    where: { clinicId, patientId },
    orderBy: [{ collectedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    omit: { file: true },
    include: { uploadedBy: { select: { name: true } }, results: { select: { flag: true } } },
  });
  return reports.map((r) => ({
    ...r,
    abnormal: r.results.filter((x) => isAbnormal(x.flag)).length,
    total: r.results.length,
  }));
}

export type TrendRow = {
  panel: string;
  test: string;
  unit: string | null;
  refText: string | null;
  refLow: number | null;
  refHigh: number | null;
  points: { reportId: string; date: Date | null; value: string; numeric: number | null; flag: string }[];
};

/** Every test across all ready reports, grouped and ordered clinically, newest value first. */
export async function patientTrends(patientId: string): Promise<TrendRow[]> {
  const results = await prisma.labResult.findMany({
    where: { patientId, report: { status: "ready" } },
    orderBy: [{ takenAt: { sort: "desc", nulls: "last" } }, { sortOrder: "asc" }],
    include: { report: { select: { createdAt: true } } },
  });
  const rows = new Map<string, TrendRow>();
  for (const r of results) {
    const key = r.test.toLowerCase();
    const row = rows.get(key) ?? { panel: r.panel, test: r.test, unit: r.unit, refText: r.refText, refLow: r.refLow, refHigh: r.refHigh, points: [] };
    row.points.push({ reportId: r.reportId, date: r.takenAt ?? r.report.createdAt, value: r.value, numeric: r.numeric, flag: r.flag });
    rows.set(key, row);
  }
  // Order within a panel = position on the most recent report that has the test.
  const order = new Map<string, number>();
  results.forEach((r, i) => {
    const k = r.test.toLowerCase();
    if (!order.has(k)) order.set(k, r.sortOrder + i / 1e6);
  });
  return [...rows.values()].sort((a, b) => panelRank(a.panel) - panelRank(b.panel) || (order.get(a.test.toLowerCase())! - order.get(b.test.toLowerCase())!));
}

/** For the doctor's sidebar: latest abnormal values + the newest report's headline. */
export async function labSnapshot(clinicId: string, patientId: string) {
  const [latest, trends] = await Promise.all([
    prisma.labReport.findFirst({
      where: { clinicId, patientId, status: "ready" },
      orderBy: [{ collectedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: { id: true, title: true, labName: true, collectedAt: true, insights: true },
    }),
    patientTrends(patientId),
  ]);
  const abnormal = trends
    .filter((t) => isAbnormal(t.points[0].flag))
    .map((t) => ({ test: t.test, value: t.points[0].value, unit: t.unit, flag: t.points[0].flag, date: t.points[0].date, prev: t.points[1]?.numeric ?? null, now: t.points[0].numeric }));
  return { latest, abnormal, testCount: trends.length };
}
