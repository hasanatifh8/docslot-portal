import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmt } from "@/lib/format";
import { audit } from "@/lib/audit";
import { reportWindow } from "@/lib/reports";
import { dailySeries, shiftMonth, toMonths } from "@/lib/finance";

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((c) => (c == null ? "" : /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\r\n");

/** Excel-friendly CSV of visits or payments for the chosen period. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports.view")) return new Response("Forbidden", { status: 403 });
  // Patient-level visit rows are clinical data — not for the finance-only role.
  if (req.nextUrl.searchParams.get("type") === "visits" && !can(user.role, "patients.view")) return new Response("Forbidden", { status: 403 });
  const tz = user.clinic.timezone;
  const sp = req.nextUrl.searchParams;
  const w = reportWindow(tz, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, range: "custom" });
  const type = ["payments", "pnl"].includes(sp.get("type") ?? "") ? sp.get("type")! : "visits";

  let body: string;
  if (type === "pnl") {
    // 12 months ending with ?month=YYYY-MM (default: this month)
    const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? sp.get("month")! : w.to.slice(0, 7);
    const first = `${shiftMonth(month, -11)}-01`;
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    const months = toMonths(await dailySeries(user.clinicId, tz, first, last));
    body = csv([
      ["Month", "Patients seen", "Billed (₹)", "Collected (₹)", "Expenses (₹)", "Net profit (₹)", "Margin %"],
      ...months.map((m) => [m.month, m.visits, m.billed / 100, m.collected / 100, m.expenses / 100, m.profit / 100, m.collected ? Math.round((m.profit / m.collected) * 100) : ""]),
    ]);
  } else if (type === "visits") {
    const visits = await prisma.visit.findMany({
      where: { clinicId: user.clinicId, checkedInAt: { gte: w.start, lt: w.end } },
      orderBy: { checkedInAt: "asc" },
      omit: { prescriptionPdf: true },
      include: { patient: true, doctor: true, invoice: { select: { number: true, total: true, paid: true } } },
    });
    body = csv([
      ["Date", "Token", "UHID", "Patient", "Gender", "Phone", "Doctor", "Type", "Priority", "Status", "Checked in", "Consult start", "Completed", "Diagnosis", "ICD-10", "Bill", "Billed (₹)", "Paid (₹)"],
      ...visits.map((v) => [
        fmt(v.checkedInAt, tz, "yyyy-MM-dd"),
        v.token,
        v.patient.uhid,
        v.patient.name,
        v.patient.gender,
        v.patient.waPhone,
        v.doctor.name,
        v.visitType,
        v.priority,
        v.status,
        fmt(v.checkedInAt, tz, "HH:mm"),
        v.consultStartedAt ? fmt(v.consultStartedAt, tz, "HH:mm") : "",
        v.completedAt ? fmt(v.completedAt, tz, "HH:mm") : "",
        v.diagnosis,
        v.icdCode,
        v.invoice?.number,
        v.invoice ? v.invoice.total / 100 : "",
        v.invoice ? v.invoice.paid / 100 : "",
      ]),
    ]);
  } else {
    const payments = await prisma.payment.findMany({
      where: { invoice: { clinicId: user.clinicId }, createdAt: { gte: w.start, lt: w.end } },
      orderBy: { createdAt: "asc" },
      include: { invoice: { include: { patient: true } }, receivedBy: { select: { name: true } } },
    });
    body = csv([
      ["Date", "Time", "Bill", "UHID", "Patient", "Kind", "Mode", "Amount (₹)", "Reference", "Reason", "By"],
      ...payments.map((p) => [
        fmt(p.createdAt, tz, "yyyy-MM-dd"),
        fmt(p.createdAt, tz, "HH:mm"),
        p.invoice.number,
        p.invoice.patient.uhid,
        p.invoice.patient.name,
        p.kind,
        p.mode,
        (p.kind === "refund" ? -p.amount : p.amount) / 100,
        p.reference,
        p.reason,
        p.receivedBy?.name,
      ]),
    ]);
  }
  await audit(user, "report.export", { entity: "report" }, `Exported ${type} CSV ${w.from} to ${w.to}`);
  return new Response(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="docslot-${type}-${w.from}-to-${w.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
