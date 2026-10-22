"use client";

import { Check } from "lucide-react";
import { cn } from "@/components/ui";

/** Progress header for multi-step flows. Completed steps are clickable to go back. */
export function WizardSteps({
  steps,
  current,
  onJump,
}: {
  steps: string[];
  current: number;
  onJump?: (i: number) => void;
}) {
  return (
    <nav aria-label="Progress" className="mb-6">
      {/* Phone: compact "Step 2 of 5 · Patient" + bar */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-brand-700">
            Step {current + 1} of {steps.length}
          </span>
          <span className="font-medium text-slate-600">{steps[current]}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="hidden items-center sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done || !onJump}
                onClick={() => onJump?.(i)}
                aria-current={active ? "step" : undefined}
                className={cn("group flex items-center gap-2.5 rounded-full py-1 pr-2 text-left", done && onJump && "cursor-pointer")}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    done && "bg-brand-600 text-white group-hover:bg-brand-700",
                    active && "bg-white text-brand-700 ring-2 ring-brand-500 shadow-md shadow-brand-600/20",
                    !done && !active && "bg-slate-100 text-slate-400"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap",
                    active ? "text-slate-900" : done ? "text-slate-600 group-hover:text-brand-700" : "text-slate-400"
                  )}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className={cn("mx-3 h-0.5 flex-1 rounded-full transition-colors", done ? "bg-brand-500" : "bg-slate-200")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Sticky Back / Next bar — the primary action is always in the same place. */
export function WizardFooter({
  onBack,
  backLabel = "Back",
  children,
  hint,
}: {
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ← {backLabel}
        </button>
      )}
      {hint && <span className="hidden text-xs text-slate-400 sm:block">{hint}</span>}
      <div className="ml-auto flex gap-2">{children}</div>
    </div>
  );
}

/** Inline field error, announced to screen readers. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
      {children}
    </p>
  );
}
