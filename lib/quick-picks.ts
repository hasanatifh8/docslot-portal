// One-tap phrases for front desk and doctors, so common entries are a click,
// not typing. Pure data — client-safe.

export const COMPLAINTS = [
  "Fever",
  "Cough",
  "Cold & runny nose",
  "Sore throat",
  "Headache",
  "Body ache",
  "Abdominal pain",
  "Vomiting",
  "Loose motions",
  "Acidity",
  "Chest pain",
  "Breathlessness",
  "Back pain",
  "Joint pain",
  "Giddiness",
  "Skin rash",
  "Burning urination",
  "Weakness",
  "BP check",
  "Sugar check",
  "Follow-up review",
];

export const EXAM_FINDINGS = [
  "Conscious, oriented",
  "Afebrile",
  "Febrile",
  "No pallor, icterus, cyanosis",
  "Throat congested",
  "Chest clear, AEBE",
  "Wheeze present",
  "Crepitations",
  "Abdomen soft, non-tender",
  "Epigastric tenderness",
  "CVS: S1 S2 normal",
  "Local tenderness",
];

export const ADVICE = [
  "Plenty of oral fluids",
  "Adequate rest",
  "Steam inhalation twice daily",
  "Salt-restricted diet",
  "Low-sugar diet, regular walking",
  "Avoid spicy & oily food",
  "Warm saline gargles",
  "Hot fomentation",
  "Avoid lifting heavy weights",
  "Monitor BP at home",
  "Monitor blood sugar at home",
  "Return immediately if symptoms worsen",
];

export const COMMON_ALLERGIES = ["Penicillin", "Sulfa drugs", "NSAIDs", "Aspirin", "Cephalosporins", "Peanuts", "Seafood", "Dust", "Latex"];

export const COMMON_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Thyroid disorder",
  "Heart disease",
  "Kidney disease",
  "COPD",
  "Epilepsy",
  "Pregnancy",
];

export const RELATIONS = [
  { value: "self", label: "Self" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "other", label: "Other" },
] as const;

export const ID_TYPES = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "abha", label: "ABHA" },
  { value: "pan", label: "PAN" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other" },
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** Follow-up shortcuts: label → days from today. */
export const FOLLOW_UPS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

export const PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "priority", label: "Priority", hint: "Senior citizen, pregnant, disabled" },
  { value: "emergency", label: "Emergency", hint: "Called first" },
] as const;

export function relationLabel(r: string | null | undefined) {
  return RELATIONS.find((x) => x.value === r)?.label ?? null;
}

/** Comma-joined field ⇄ chip list. */
export function splitList(s: string | null | undefined) {
  return (s ?? "")
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
