"use client";

import { useState } from "react";
import { Hospital, LogOut, Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { EcgLine } from "@/components/ui";
import { Logo } from "@/components/brand";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS, isRole } from "@/lib/rbac";

export function AppShell({
  clinicName,
  userName,
  role,
  initials,
  children,
}: {
  clinicName: string;
  userName: string;
  role: string;
  initials: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-brand-900/[0.06] bg-white px-4 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-brand-900/30 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-brand-900/[0.06] bg-white transition-transform duration-200 md:static md:w-64 md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-50 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3">
          <div className="bg-crosses relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Hospital className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-medium tracking-wider text-brand-100/80 uppercase">Hospital</div>
                <div className="truncate text-sm font-semibold">{clinicName}</div>
              </div>
            </div>
            <EcgLine className="mt-2 h-4 w-full text-accent-500/90" />
          </div>
        </div>

        <SidebarNav role={role} onNavigate={() => setOpen(false)} />

        <div className="p-3">
          <div className="flex items-center gap-3 rounded-xl bg-canvas px-2.5 py-2 ring-1 ring-brand-900/[0.05]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{userName}</div>
              <div className="truncate text-xs font-medium text-brand-600">{isRole(role) ? ROLE_LABELS[role] : role}</div>
            </div>
            <form action={logoutAction}>
              <button
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="scrollbar-slim min-w-0 flex-1 overflow-auto bg-canvas">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
