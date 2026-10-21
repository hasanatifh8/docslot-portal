"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarHeart,
  ClipboardPlus,
  LayoutDashboard,
  Settings,
  Stethoscope,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { cn } from "@/components/ui";
import { can, type Permission } from "@/lib/rbac";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: Permission };

const sections: { title: string; items: Item[] }[] = [
  {
    title: "Clinical",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/opd", label: "OPD queue", icon: ClipboardPlus, perm: "opd.view" },
      { href: "/patients", label: "Patients", icon: UsersRound, perm: "patients.view" },
      { href: "/appointments", label: "Appointments", icon: CalendarHeart, perm: "appointments.view" },
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

export function SidebarNav({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-slim flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section) => {
        const items = section.items.filter((i) => !i.perm || can(role, i.perm));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-brand-600 text-white shadow-md shadow-brand-700/25"
                        : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] transition-colors",
                        active ? "text-white" : "text-slate-400 group-hover:text-brand-600"
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
