// Sidebar structure. Shared by the sidebar and the command palette — kept out
// of "use client" modules so both server and client code can import it.
import { BarChart3, CalendarHeart, CalendarSync, ClipboardPlus, IndianRupee, LayoutDashboard, ScrollText, Settings, Stethoscope, UserRoundCog, UsersRound } from "@/components/icons";
import type { AppIcon } from "@/components/icons";
import type { Permission } from "@/lib/rbac";

export type NavTone = "brand" | "violet" | "sky" | "amber" | "emerald" | "indigo" | "rose" | "cyan" | "slate";
export type NavItem = { href: string; label: string; icon: AppIcon; tone: NavTone; perm?: Permission };

/** Colour-coded icon chips so each area is recognisable at a glance. */
export const NAV_TONES: Record<NavTone, string> = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  cyan: "bg-cyan-50 text-cyan-600 ring-cyan-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Front desk",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "brand" },
      { href: "/opd", label: "OPD queue", icon: ClipboardPlus, tone: "cyan", perm: "opd.view" },
      { href: "/appointments", label: "Appointments", icon: CalendarHeart, tone: "violet", perm: "appointments.view" },
      { href: "/patients", label: "Patients", icon: UsersRound, tone: "sky", perm: "patients.view" },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarSync, tone: "amber", perm: "followups.view" },
    ],
  },
  {
    title: "Billing",
    items: [{ href: "/billing", label: "Billing & receipts", icon: IndianRupee, tone: "emerald", perm: "billing.view" }],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, tone: "indigo", perm: "reports.view" },
      { href: "/audit", label: "Audit log", icon: ScrollText, tone: "slate", perm: "audit.view" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/doctors", label: "Doctors & departments", icon: Stethoscope, tone: "rose", perm: "doctors.manage" },
      { href: "/staff", label: "Staff", icon: UserRoundCog, tone: "cyan", perm: "staff.manage" },
      { href: "/settings", label: "Settings", icon: Settings, tone: "slate", perm: "settings.manage" },
    ],
  },
];
