// Sidebar structure. Shared by the sidebar and the command palette — kept out
// of "use client" modules so both server and client code can import it.
import {
  BarChart3,
  CalendarHeart,
  CalendarSync,
  ClipboardPlus,
  IndianRupee,
  LayoutDashboard,
  ScrollText,
  Settings,
  Stethoscope,
  UserRoundCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/rbac";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: Permission };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Front desk",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/opd", label: "OPD queue", icon: ClipboardPlus, perm: "opd.view" },
      { href: "/appointments", label: "Appointments", icon: CalendarHeart, perm: "appointments.view" },
      { href: "/patients", label: "Patients", icon: UsersRound, perm: "patients.view" },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarSync, perm: "followups.view" },
    ],
  },
  {
    title: "Billing",
    items: [{ href: "/billing", label: "Billing & receipts", icon: IndianRupee, perm: "billing.view" }],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
      { href: "/audit", label: "Audit log", icon: ScrollText, perm: "audit.view" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/doctors", label: "Doctors & departments", icon: Stethoscope, perm: "doctors.manage" },
      { href: "/staff", label: "Staff", icon: UserRoundCog, perm: "staff.manage" },
      { href: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    ],
  },
];
