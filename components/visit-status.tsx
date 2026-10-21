"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { STAGE_ICONS } from "@/components/stage-icons";
import { PIPELINE, STATUS_LABELS, type VisitStatus } from "@/lib/encounter";
import { Badge, cn } from "@/components/ui";

const TONES: Record<VisitStatus, "amber" | "brand" | "green" | "slate" | "red"> = {
  CHECKED_IN: "slate",
  TRIAGE_IN_PROGRESS: "amber",
  TRIAGE_COMPLETED: "green",
  IN_CONSULTATION: "brand",
  COMPLETED: "slate",
  CANCELLED: "red",
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const Icon = STAGE_ICONS[status];
  return (
    <Badge tone={TONES[status]} className="gap-1 normal-case">
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Care pathway: icon nodes joined by a progress rail. */
export function VisitStepper({
  status,
  times,
}: {
  status: VisitStatus;
  times: Partial<Record<VisitStatus, string>>; // preformatted "h:mm a" per step
}) {
  const current = PIPELINE.indexOf(status as (typeof PIPELINE)[number]);
  const cancelled = status === "CANCELLED";
  return (
    <ol className="grid grid-cols-5">
      {PIPELINE.map((s, i) => {
        const done = !cancelled && (i < current || status === "COMPLETED");
        const active = !cancelled && i === current && status !== "COMPLETED";
        const Icon = done ? Check : STAGE_ICONS[s];
        return (
          <li key={s} className="relative flex min-w-0 flex-col items-center text-center">
            {i > 0 && (
              <div
                aria-hidden
                className={cn(
                  "absolute top-[18px] right-1/2 h-0.5 w-full -translate-y-1/2",
                  done || active ? "bg-brand-500" : "bg-slate-200"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white transition-colors",
                done && "bg-brand-600 text-white",
                active && "bg-brand-50 text-brand-700 ring-brand-100 outline-2 outline-brand-500",
                !done && !active && "bg-slate-100 text-slate-400"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "animate-pulse")} />
            </div>
            <span
              className={cn(
                "mt-2 line-clamp-2 px-0.5 text-[11px] leading-tight font-medium",
                active ? "text-brand-700" : done ? "text-slate-700" : "text-slate-400"
              )}
            >
              {STATUS_LABELS[s]}
            </span>
            <span className="text-[10px] text-slate-400">{times[s] ?? "\u00a0"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Keeps queue screens in sync across reception, triage and doctor desks. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
