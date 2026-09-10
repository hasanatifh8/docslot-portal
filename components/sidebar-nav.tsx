"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Stethoscope, Settings } from "lucide-react";
import { cn } from "@/components/ui";

const items = [
  { href: "/dashboard", label: "Today", icon: CalendarDays },
  { href: "/appointments", label: "Appointments", icon: ClipboardList },
  { href: "/doctors", label: "Doctors & hours", icon: Stethoscope },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
