"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { can } from "@/lib/rbac";
import { NAV_SECTIONS } from "@/components/nav-items";

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
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
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
