"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft } from "lucide-react";
import type { AppIcon } from "@/components/icons";
import { CalendarPlus, ClipboardPlus, IndianRupee, Search, UserRoundPlus, UsersRound } from "@/components/icons";
import { cn, Kbd } from "@/components/ui";
import { PatientAvatar } from "@/components/patient-avatar";
import { can } from "@/lib/rbac";
import { NAV_SECTIONS } from "@/components/nav-items";

export type PatientHit = {
  id: string;
  name: string | null;
  uhid: string | null;
  waPhone: string;
  gender: string | null;
  age: number | null;
  relation: string | null;
};

type Item =
  | { kind: "action"; id: string; label: string; hint?: string; icon: AppIcon; href: string }
  | { kind: "patient"; id: string; patient: PatientHit };

/** Debounced patient search shared by the palette and pickers. */
export function usePatientSearch(q: string, delay = 180) {
  const term = q.trim();
  // Results are remembered per search term, so a stale answer never shows for a new query.
  const [result, setResult] = useState<{ term: string; hits: PatientHit[] }>({ term: "", hits: [] });
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/patients/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setResult({ term, hits: d }))
        .catch(() => {});
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, delay]);
  if (term.length < 2) return { hits: [] as PatientHit[], loading: false };
  return result.term === term ? { hits: result.hits, loading: false } : { hits: result.hits, loading: true };
}

export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rawActive, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { hits, loading } = usePatientSearch(open ? q : "");

  const actions = useMemo(() => {
    const quick: Extract<Item, { kind: "action" }>[] = [];
    if (can(role, "patients.edit"))
      quick.push({ kind: "action", id: "new-patient", label: "Register new patient", icon: UserRoundPlus, href: "/patients/new" });
    if (can(role, "appointments.manage"))
      quick.push({ kind: "action", id: "book", label: "Book appointment", icon: CalendarPlus, href: "/appointments/new" });
    if (can(role, "opd.checkin"))
      quick.push({ kind: "action", id: "checkin", label: "Check in a patient", icon: ClipboardPlus, href: "/opd?checkin=1" });
    if (can(role, "billing.collect"))
      quick.push({ kind: "action", id: "billing", label: "Collect payment", icon: IndianRupee, href: "/billing" });
    const pages = NAV_SECTIONS.flatMap((s) => s.items)
      .filter((i) => !i.perm || can(role, i.perm))
      .map((i) => ({ kind: "action" as const, id: i.href, label: `Go to ${i.label}`, icon: i.icon, href: i.href, hint: "Page" }));
    return [...quick, ...pages];
  }, [role]);

  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const acts = term ? actions.filter((a) => a.label.toLowerCase().includes(term)) : actions;
    return [...hits.map((p) => ({ kind: "patient" as const, id: p.id, patient: p })), ...acts];
  }, [q, hits, actions]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  const go = useCallback(
    (item: Item) => {
      close();
      router.push(item.kind === "patient" ? `/patients/${item.patient.id}` : item.href);
    },
    [close, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);
  const active = Math.min(rawActive, Math.max(0, items.length - 1));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-brand-950/30 p-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={close}>
      <div
        role="dialog"
        aria-label="Search and quick actions"
        className="dialog-in w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-brand-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter" && items[active]) go(items[active]);
            }}
            placeholder="Search patient by name, UHID or phone — or type an action"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" className="scrollbar-slim max-h-[55vh] overflow-y-auto p-2">
          {loading && hits.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Searching patients…</li>}
          {q.trim().length >= 2 && !loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">No patients match “{q.trim()}”.</li>
          )}
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                  i === active ? "bg-brand-50 text-brand-900" : "text-slate-700"
                )}
              >
                {item.kind === "patient" ? (
                  <>
                    <PatientAvatar name={item.patient.name} gender={item.patient.gender} className="h-8 w-8 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.patient.name || "Unnamed patient"}</div>
                      <div className="truncate text-xs text-slate-500">
                        {[item.patient.uhid, item.patient.age != null && `${item.patient.age} y`, `+${item.patient.waPhone}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <UsersRound className="h-4 w-4 text-slate-300" />
                  </>
                ) : (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.hint && <span className="text-[11px] text-slate-400">{item.hint}</span>}
                  </>
                )}
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-brand-500" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
