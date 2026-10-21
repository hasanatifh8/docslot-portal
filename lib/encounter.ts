// OPD encounter state machine. Pure module — safe to import from client components.
//
//   CHECKED_IN ──startTriage──▶ TRIAGE_IN_PROGRESS ──completeTriage──▶ TRIAGE_COMPLETED
//        │                            │                                      │
//        │                            │                              startConsultation
//        │                            │                                      ▼
//        └──────── cancel ────────────┴──────────── cancel ─────────── IN_CONSULTATION
//                                                                            │
//                                                                         finalize
//                                                                            ▼
//                                                                        COMPLETED

import type { VisitStatus } from "@prisma/client";
import type { Permission } from "@/lib/rbac";

export type { VisitStatus };

/** Pipeline order (CANCELLED is a side exit, not a step). */
export const PIPELINE = [
  "CHECKED_IN",
  "TRIAGE_IN_PROGRESS",
  "TRIAGE_COMPLETED",
  "IN_CONSULTATION",
  "COMPLETED",
] as const satisfies readonly VisitStatus[];

export const STATUS_LABELS: Record<VisitStatus, string> = {
  CHECKED_IN: "Checked in",
  TRIAGE_IN_PROGRESS: "Triage in progress",
  TRIAGE_COMPLETED: "Ready for doctor",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const OPEN_STATUSES: VisitStatus[] = ["CHECKED_IN", "TRIAGE_IN_PROGRESS", "TRIAGE_COMPLETED", "IN_CONSULTATION"];

export function isOpen(status: VisitStatus) {
  return OPEN_STATUSES.includes(status);
}

export type Transition = "startTriage" | "completeTriage" | "startConsultation" | "finalize" | "cancel";

export const TRANSITIONS: Record<Transition, { from: VisitStatus[]; to: VisitStatus; perm: Permission }> = {
  startTriage: { from: ["CHECKED_IN"], to: "TRIAGE_IN_PROGRESS", perm: "opd.triage" },
  completeTriage: { from: ["TRIAGE_IN_PROGRESS"], to: "TRIAGE_COMPLETED", perm: "opd.triage" },
  startConsultation: { from: ["TRIAGE_COMPLETED"], to: "IN_CONSULTATION", perm: "opd.consult" },
  finalize: { from: ["IN_CONSULTATION"], to: "COMPLETED", perm: "opd.consult" },
  cancel: { from: OPEN_STATUSES, to: "CANCELLED", perm: "opd.checkin" },
};

export function canTransition(status: VisitStatus, t: Transition) {
  return TRANSITIONS[t].from.includes(status);
}
