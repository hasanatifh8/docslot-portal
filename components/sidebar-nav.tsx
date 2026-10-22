"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { can } from "@/lib/rbac";
import { NAV_SECTIONS, NAV_TONES } from "@/components/nav-items";

export function SidebarNav({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="scrollbar-slim flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => !i.perm || can(role, i.perm));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, tone }) => {
                // A parent like /finance shouldn't light up on its own child entry (/finance/expenses).
                const childEntry = NAV_SECTIONS.some((s) => s.items.some((i) => i.href !== href && i.href.startsWith(href + "/") && pathname.startsWith(i.href)));
                const active = !childEntry && (pathname === href || pathname.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-700/25"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105",
                        active ? "bg-white/15 text-white ring-white/20" : NAV_TONES[tone]
                      )}
                    >
                      <Icon weight={active ? "fill" : "duotone"} className="h-[18px] w-[18px]" />
                    </span>
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
