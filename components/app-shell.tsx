"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, X } from "lucide-react";
import { CalendarPlus, ClipboardPlus, Hospital, KeyRound, LogOut, Menu, Search, UserRoundPlus } from "@/components/icons";
import { SidebarNav } from "@/components/sidebar-nav";
import { CommandPalette } from "@/components/command-palette";
import { ToastProvider } from "@/components/toast";
import { EcgLine, Kbd, cn } from "@/components/ui";
import { Logo } from "@/components/brand";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS, can, isRole } from "@/lib/rbac";

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
    <ToastProvider>
      <div className="flex flex-1 flex-col md:flex-row">
        <div aria-hidden className="app-backdrop" />
        {open && (
          <div
            className="fixed inset-0 z-30 bg-brand-900/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-white/60 bg-white/95 shadow-[4px_0_24px_-12px_rgb(15_63_60/0.12)] transition-transform md:bg-transparent md:[background:linear-gradient(180deg,rgb(255_255_255/0.82),rgb(240_250_248/0.72))] md:backdrop-blur-xl duration-200 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:translate-x-0 ${
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
            <div className="flex items-center gap-3 rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-brand-900/[0.06]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{userName}</div>
                <div className="truncate text-xs font-medium text-brand-600">{isRole(role) ? ROLE_LABELS[role] : role}</div>
              </div>
              <Link
                href="/account"
                title="Change password"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-700"
              >
                <KeyRound className="h-4 w-4" />
              </Link>
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

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar role={role} onMenu={() => setOpen(true)} />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
          </main>
        </div>
        <CommandPalette role={role} />
      </div>
    </ToastProvider>
  );
}

function TopBar({ role, onMenu }: { role: string; onMenu: () => void }) {
  return (
    <header className="glass sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/70 px-3 shadow-[0_8px_24px_-18px_rgb(15_63_60/0.25)] sm:gap-3 sm:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="md:hidden">
        <Logo className="h-6" />
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-slate-100/80 px-3 text-sm text-slate-500 ring-1 ring-slate-200/70 transition hover:bg-white hover:ring-brand-200 md:ml-0 md:w-full md:max-w-md"
        aria-label="Search patients and actions"
      >
        <Search className="h-4 w-4" />
        <span className="hidden flex-1 text-left md:inline">Search patients, UHID, phone…</span>
        <span className="hidden items-center gap-1 md:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <QuickNew role={role} />
    </header>
  );
}

function QuickNew({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    can(role, "patients.edit") && { href: "/patients/new", label: "Register patient", hint: "New UHID", icon: UserRoundPlus },
    can(role, "appointments.manage") && { href: "/appointments/new", label: "Book appointment", hint: "Pick a slot", icon: CalendarPlus },
    can(role, "opd.checkin") && { href: "/opd?checkin=1", label: "OPD check-in", hint: "Walk-in token", icon: ClipboardPlus },
  ].filter(Boolean) as { href: string; label: string; hint: string; icon: typeof Plus }[];
  if (!items.length) return null;

  return (
    <div ref={ref} className="relative md:ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white shadow-sm shadow-brand-700/25 transition hover:bg-brand-700 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 transition sm:block", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="dialog-in absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl ring-1 shadow-brand-900/10 ring-brand-900/10">
          {items.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-brand-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-slate-800">{label}</div>
                <div className="text-[11px] text-slate-400">{hint}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
