"use client";

import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { Logo } from "@/components/brand";
import { logoutAction } from "@/app/actions/auth";

export function AppShell({
  clinicName,
  userName,
  userEmail,
  initials,
  children,
}: {
  clinicName: string;
  userName: string;
  userEmail: string;
  initials: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:w-60 md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Clinic</div>
          <div className="truncate text-sm font-medium text-slate-800">{clinicName}</div>
        </div>

        <SidebarNav onNavigate={() => setOpen(false)} />

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{userName}</div>
              <div className="truncate text-xs text-slate-400">{userEmail}</div>
            </div>
            <form action={logoutAction}>
              <button
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="scrollbar-slim min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
