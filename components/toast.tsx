"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/components/ui";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; title: string; body?: string };

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Brief, non-blocking confirmations ("Patient registered", "₹500 collected"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.tone === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 shadow-brand-900/10 ring-brand-900/10"
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  t.tone === "success" && "bg-emerald-50 text-emerald-600",
                  t.tone === "error" && "bg-rose-50 text-rose-600",
                  t.tone === "info" && "bg-brand-50 text-brand-600"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-900">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-slate-500">{t.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
                className="text-slate-300 hover:text-slate-500"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Fire a toast when a server-action state flips to ok/error. */
export function useActionToast(
  state: { ok?: boolean | string; error?: string; savedAt?: number },
  success: string | ((s: typeof state) => string),
  opts: { errors?: boolean } = {}
) {
  const toast = useToast();
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok) toast({ tone: "success", title: typeof success === "function" ? success(state) : success });
    else if (state.error && opts.errors) toast({ tone: "error", title: state.error });
  }, [state, success, toast, opts.errors]);
}
