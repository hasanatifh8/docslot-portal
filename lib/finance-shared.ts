// Finance helpers with no server dependencies — safe for client components.

export const EXPENSE_CATEGORIES = [
  { value: "salaries", label: "Salaries & wages" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Electricity & utilities" },
  { value: "consumables", label: "Medical consumables" },
  { value: "equipment", label: "Equipment" },
  { value: "maintenance", label: "Repairs & maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "it", label: "IT & software" },
  { value: "other", label: "Other" },
] as const;

export function categoryLabel(c: string) {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string, style: "short" | "long" = "short") {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: style, year: style === "long" ? "numeric" : "2-digit", timeZone: "UTC" });
}

