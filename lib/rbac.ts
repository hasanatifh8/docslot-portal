// Role-based access. Pure module — safe to import from client components.

export const ROLES = ["admin", "doctor", "junior_doctor", "nurse", "receptionist", "accountant"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  doctor: "Senior doctor",
  junior_doctor: "Junior doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  accountant: "Accountant",
};

// Everyone who works with patients (the accountant sees money, not charts).
const ALL: readonly Role[] = ["admin", "doctor", "junior_doctor", "nurse", "receptionist"];

const PERMISSIONS = {
  "patients.view": ALL,
  "patients.edit": ["admin", "receptionist", "nurse"],
  "appointments.view": ALL,
  "appointments.manage": ["admin", "receptionist"],
  "opd.view": ALL,
  "opd.checkin": ["admin", "receptionist", "nurse"],
  // Triage = vitals capture, done before the senior doctor sees the patient.
  "opd.triage": ["admin", "junior_doctor", "nurse"],
  "opd.consult": ["admin", "doctor"],
  "followups.view": ["admin", "receptionist", "doctor", "nurse"],
  // Lab & diagnostic reports: anyone clinical can view and upload; removing is admin/doctor.
  "labs.view": ALL,
  "labs.upload": ALL,
  "labs.delete": ["admin", "doctor"],
  "billing.view": ["admin", "receptionist", "accountant"],
  "billing.collect": ["admin", "receptionist"],
  // Discounts and refunds move money out — admin only.
  "billing.adjust": ["admin"],
  "reports.view": ["admin", "accountant"],
  "finance.view": ["admin", "accountant"],
  "expenses.manage": ["admin", "accountant"],
  "audit.view": ["admin"],
  "doctors.manage": ["admin"],
  "staff.manage": ["admin"],
  "settings.manage": ["admin"],
} satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(r: string): r is Role {
  return (ROLES as readonly string[]).includes(r);
}

export function can(role: string, perm: Permission): boolean {
  return isRole(role) && (PERMISSIONS[perm] as readonly Role[]).includes(role);
}
