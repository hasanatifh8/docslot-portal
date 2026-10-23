// Lab vocabulary shared by the AI reader, the report viewer and trends.
// Pure module — client-safe.

/** Fixed clinical order, so every report reads the same way top to bottom. */
export const PANELS = [
  { key: "haematology", label: "Haematology (CBC)" },
  { key: "inflammation", label: "Inflammation (ESR, CRP)" },
  { key: "diabetes", label: "Diabetes (glucose, HbA1c)" },
  { key: "lipids", label: "Lipid profile" },
  { key: "liver", label: "Liver function" },
  { key: "kidney", label: "Kidney function" },
  { key: "electrolytes", label: "Electrolytes & minerals" },
  { key: "thyroid", label: "Thyroid" },
  { key: "vitamins", label: "Vitamins" },
  { key: "iron", label: "Iron studies" },
  { key: "cardiac", label: "Cardiac markers" },
  { key: "hormones", label: "Hormones" },
  { key: "infection", label: "Infection & serology" },
  { key: "urine", label: "Urine analysis" },
  { key: "coagulation", label: "Coagulation" },
  { key: "tumour_markers", label: "Tumour markers" },
  { key: "imaging", label: "Imaging & other findings" },
  { key: "other", label: "Other tests" },
] as const;
export type PanelKey = (typeof PANELS)[number]["key"];
export const PANEL_KEYS = PANELS.map((p) => p.key) as [PanelKey, ...PanelKey[]];

export function panelLabel(k: string) {
  return PANELS.find((p) => p.key === k)?.label ?? k;
}
export function panelRank(k: string) {
  const i = PANELS.findIndex((p) => p.key === k);
  return i < 0 ? PANELS.length : i;
}

export const FLAGS = ["normal", "low", "high", "critical_low", "critical_high", "abnormal", "unknown"] as const;
export type LabFlag = (typeof FLAGS)[number];

export const FLAG_LABEL: Record<LabFlag, string> = {
  normal: "Normal",
  low: "Low",
  high: "High",
  critical_low: "Critically low",
  critical_high: "Critically high",
  abnormal: "Abnormal",
  unknown: "—",
};

export function isAbnormal(flag: string) {
  return flag !== "normal" && flag !== "unknown";
}
export function isCritical(flag: string) {
  return flag === "critical_low" || flag === "critical_high";
}

/**
 * Re-derive low/high from the numbers when both a value and a range exist,
 * so a mis-read flag can't contradict the printed reference interval.
 * Critical flags from the reader are kept (labs mark them explicitly).
 */
export function checkFlag(flag: LabFlag, numeric: number | null, low: number | null, high: number | null): LabFlag {
  if (isCritical(flag) || numeric == null) return flag;
  if (low != null && numeric < low) return "low";
  if (high != null && numeric > high) return "high";
  if (low != null || high != null) return "normal";
  return flag;
}

export const SEVERITIES = ["info", "attention", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type LabInsights = {
  headline: string;
  keyFindings: { finding: string; tests: string[]; severity: Severity }[];
  patterns: string[];
  followUp: string[];
  nameMismatch: string | null;
};
