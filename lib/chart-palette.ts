// Chart colours. Categorical order validated with the dataviz palette checker
// (lightness band, chroma floor, adjacent CVD ΔE ≥ 8, normal-vision ΔE ≥ 15).
// Yellow and pink sit under 3:1 on white, so any chart using slots 4–5 must
// also show direct labels or a table (the "relief rule").
export const SERIES = {
  teal: "#0f9488", // slot 1 — revenue / primary
  orange: "#eb6834", // slot 2 — expenses / comparison
  violet: "#6250d6", // slot 3
  yellow: "#eda100", // slot 4
  pink: "#e87ba4", // slot 5
  blue: "#2a78d6", // slot 6
} as const;
export const SERIES_ORDER = [SERIES.teal, SERIES.orange, SERIES.violet, SERIES.yellow, SERIES.pink, SERIES.blue];

// One-hue sequential ramp (brand teal) for heatmaps: light = little, dark = a lot.
export const TEAL_RAMP = ["#effcf9", "#d2f5ee", "#a5eadd", "#6dd8c8", "#34bdac", "#14a191", "#0c8276", "#0e6860", "#10544f"];

export const INK = { primary: "#0f172a", secondary: "#475569", muted: "#94a3b8", grid: "#e2e8f0" };

/** ₹ compact in Indian units: ₹950 · ₹12.5k · ₹3.4L · ₹1.2Cr */
export function inrShort(paise: number) {
  const r = paise / 100;
  const abs = Math.abs(r);
  const sign = r < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}
