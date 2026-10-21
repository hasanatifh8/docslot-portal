// Shared by server pages and client components — must not be a "use client" module,
// or server components would receive a client reference instead of the map.
import { BadgeCheck, CircleX, ClipboardCheck, ClipboardList, HeartPulse, Stethoscope } from "lucide-react";
import type { VisitStatus } from "@/lib/encounter";

export const STAGE_ICONS: Record<VisitStatus, React.ComponentType<{ className?: string }>> = {
  CHECKED_IN: ClipboardList,
  TRIAGE_IN_PROGRESS: HeartPulse,
  TRIAGE_COMPLETED: ClipboardCheck,
  IN_CONSULTATION: Stethoscope,
  COMPLETED: BadgeCheck,
  CANCELLED: CircleX,
};
