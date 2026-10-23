// AI lab-report reader: sends an uploaded PDF / photo to Claude and stores
// structured results + a doctor-facing summary. Runs after the upload
// response (next/server `after`), so staff never wait on it.
//
// Requires ANTHROPIC_API_KEY. Without it, reports are kept as "unreadable"
// and doctors can still open the original file.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/patients";
import { parseDateOnly } from "@/lib/format";
import { FLAGS, PANEL_KEYS, SEVERITIES, checkFlag, panelRank, type LabInsights } from "@/lib/labs";

export const LAB_MODEL = "claude-opus-5-5";
export const MAX_FILE_BYTES = 30 * 1024 * 1024; // API request cap is 32 MB (base64 adds ~33 %; see route for the upload cap)
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function readerConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const ExtractionSchema = z.object({
  is_medical_report: z.boolean().describe("false if the file is not a lab/diagnostic report (e.g. a bill, an ID card, a random photo)"),
  report: z.object({
    title: z.string().nullable().describe("Report / package name as printed, e.g. 'Comprehensive full body checkup'"),
    lab_name: z.string().nullable(),
    report_type: z.enum(["blood", "urine", "imaging", "other"]),
    patient_name_on_report: z.string().nullable(),
    collected_on: z.string().nullable().describe("Sample collection date as YYYY-MM-DD"),
    reported_on: z.string().nullable().describe("Report date as YYYY-MM-DD"),
  }),
  results: z
    .array(
      z.object({
        panel: z.enum(PANEL_KEYS).describe("Clinical group the test belongs to"),
        test: z.string().describe("Standard test name in British/Indian clinical usage, e.g. 'Haemoglobin', 'HbA1c', 'TSH', 'Vitamin D (25-OH)'"),
        test_on_report: z.string().describe("Name exactly as printed"),
        value: z.string().describe("Result exactly as printed, including qualitative results like 'Negative' or 'Trace'"),
        numeric_value: z.number().nullable().describe("The value as a number when it is numeric, else null"),
        unit: z.string().nullable(),
        reference_range: z.string().nullable().describe("Reference interval as printed"),
        ref_low: z.number().nullable(),
        ref_high: z.number().nullable(),
        flag: z.enum(FLAGS).describe("Compare value with the printed reference interval; use critical_* only when the lab marks it critical or it is clearly dangerous"),
        page: z.number().nullable().describe("1-based page number where the result appears"),
      })
    )
    .describe("Every measured result in the report, including normal ones. Skip calculated duplicates only if the same test appears twice."),
  insights: z.object({
    headline: z.string().describe("One sentence a busy doctor can read in 3 seconds"),
    key_findings: z
      .array(
        z.object({
          finding: z.string().describe("Plain clinical statement with the numbers, e.g. 'Microcytic hypochromic anaemia: Hb 10.8 g/dL, MCV 78.3 fL, MCH 25.1 pg, RDW 16.5 %'"),
          tests: z.array(z.string()).describe("Standard names of the tests this finding is based on"),
          severity: z.enum(SEVERITIES),
        })
      )
      .describe("Abnormal results grouped into clinically meaningful findings, most important first. Empty if everything is normal."),
    patterns: z.array(z.string()).describe("Patterns the results are consistent with, phrased as considerations ('consistent with…', 'may suggest…'), never as a diagnosis"),
    follow_up: z.array(z.string()).describe("Reasonable follow-up tests or checks a doctor might consider; no drug or dose recommendations"),
  }),
});
type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You read laboratory and diagnostic reports for doctors in an Indian hospital OPD.

Your job is to save the doctor from reading every page:
1. Extract every measured result faithfully — value, unit and reference interval exactly as printed. Never invent or "correct" a value; if something is illegible, leave it out rather than guess.
2. Map each test to a standard name and one clinical panel, so results from different labs line up.
3. Flag each result against its printed reference interval.
4. Summarise what matters: group related abnormal results into findings with the numbers, most important first.

Ignore marketing text, method descriptions, interpretation boilerplate, QR codes and page furniture.
Write for a doctor: concise, clinical, no patient-facing reassurance. Findings and patterns are decision support for a qualified doctor, not a diagnosis.`;

function client() {
  return new Anthropic();
}

/** Read one stored report and save its results. Never throws (status records the outcome). */
export async function processLabReport(reportId: string) {
  const report = await prisma.labReport.findUnique({ where: { id: reportId }, include: { patient: true } });
  if (!report) return;
  if (!readerConfigured()) {
    await prisma.labReport.update({
      where: { id: reportId },
      data: { status: "unreadable", error: "AI reader isn't configured (set ANTHROPIC_API_KEY). The original file is available." },
    });
    return;
  }

  const p = report.patient;
  const data = Buffer.from(report.file).toString("base64");
  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    report.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: report.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } };

  try {
    const stream = client().beta.messages.stream({
      model: LAB_MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: `Registered patient: ${p.name ?? "unknown"}, ${ageFrom(p.dob) ?? "?"} y, ${p.gender ?? "gender not recorded"}. If the name on the report clearly belongs to someone else, still extract it.\n\nRead this report and return the structured extraction.`,
            },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new ReaderError("The AI reader declined this file. Open the original to review it.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new ReaderError("This report is too long to read in one go. Split it into smaller files and upload again.");
    }
    const parsed = parseOutput(message);
    await saveExtraction(report.id, report.patientId, report.patient.name, parsed, message.model);
  } catch (e) {
    const msg =
      e instanceof ReaderError
        ? e.message
        : e instanceof Anthropic.RateLimitError
          ? "The AI reader is busy. Try “Read again” in a minute."
          : e instanceof Anthropic.BadRequestError
            ? "The file couldn't be read (it may be password-protected, corrupted or too large)."
            : e instanceof Anthropic.AuthenticationError
              ? "AI reader credentials are invalid — check ANTHROPIC_API_KEY."
              : e instanceof Anthropic.APIError
                ? `AI reader error (${e.status ?? "network"}). Try “Read again”.`
                : "Something went wrong while reading this report. Try “Read again”.";
    console.error("[lab-reader]", reportId, e);
    await prisma.labReport.update({ where: { id: reportId }, data: { status: "failed", error: msg } });
  }
}

class ReaderError extends Error {}

/**
 * Validate an extraction and store it exactly as the live reader would —
 * used by imports and tests. Returns false when the shape is invalid.
 */
export async function applyExtraction(reportId: string, json: unknown, model = "manual") {
  const parsed = ExtractionSchema.safeParse(json);
  if (!parsed.success) return false;
  const report = await prisma.labReport.findUniqueOrThrow({ where: { id: reportId }, include: { patient: { select: { name: true } } } });
  await saveExtraction(reportId, report.patientId, report.patient.name, parsed.data, model);
  return true;
}

function parseOutput(message: { content: Anthropic.Beta.BetaContentBlock[]; parsed_output?: unknown }): Extraction {
  const direct = ExtractionSchema.safeParse(message.parsed_output);
  if (direct.success) return direct.data;
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const again = ExtractionSchema.safeParse(JSON.parse(text));
    if (again.success) return again.data;
  } catch {
    /* fall through */
  }
  throw new ReaderError("The AI reader returned an unexpected answer. Try “Read again”.");
}

async function saveExtraction(reportId: string, patientId: string, registeredName: string | null, x: Extraction, model: string) {
  if (!x.is_medical_report) {
    await prisma.labReport.update({
      where: { id: reportId },
      data: { status: "unreadable", error: "This doesn't look like a lab or diagnostic report.", model, processedAt: new Date() },
    });
    return;
  }
  const collected = parseDateOnly(x.report.collected_on) ?? parseDateOnly(x.report.reported_on);
  const nameMismatch = mismatch(registeredName, x.report.patient_name_on_report);
  const insights: LabInsights = {
    headline: x.insights.headline,
    keyFindings: x.insights.key_findings,
    patterns: x.insights.patterns,
    followUp: x.insights.follow_up,
    nameMismatch,
  };
  const rows: Prisma.LabResultCreateManyInput[] = x.results
    .map((r) => ({
      reportId,
      patientId,
      panel: r.panel,
      test: r.test.trim(),
      testOnReport: r.test_on_report,
      value: r.value,
      numeric: r.numeric_value,
      unit: r.unit,
      refText: r.reference_range,
      refLow: r.ref_low,
      refHigh: r.ref_high,
      flag: checkFlag(r.flag, r.numeric_value, r.ref_low, r.ref_high),
      page: r.page != null ? Math.round(r.page) : null,
      takenAt: collected,
    }))
    .sort((a, b) => panelRank(a.panel) - panelRank(b.panel))
    .map((r, i) => ({ ...r, sortOrder: i }));

  await prisma.$transaction([
    prisma.labResult.deleteMany({ where: { reportId } }),
    prisma.labResult.createMany({ data: rows }),
    prisma.labReport.update({
      where: { id: reportId },
      data: {
        status: "ready",
        error: null,
        title: x.report.title,
        labName: x.report.lab_name,
        reportType: x.report.report_type,
        nameOnReport: x.report.patient_name_on_report,
        collectedAt: collected,
        reportedAt: parseDateOnly(x.report.reported_on),
        insights,
        model,
        processedAt: new Date(),
      },
    }),
  ]);
}

/** Loose name comparison: "Ms.ZAINAB IMTIAZ" vs "Zainab Imtiaz" is the same person. */
function mismatch(registered: string | null, onReport: string | null) {
  if (!registered || !onReport) return null;
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|miss|dr|master|baby|smt|shri)\b\.?/g, " ")
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const a = new Set(words(registered));
  const shared = words(onReport).filter((w) => a.has(w)).length;
  return shared === 0 ? `Name on report is “${onReport}”, but this patient is registered as “${registered}”. Check it belongs to them.` : null;
}
