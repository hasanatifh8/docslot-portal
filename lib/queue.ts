// OPD queue ordering — pure, shared by the queue page and the token display.

export const PRIORITY_RANK: Record<string, number> = { emergency: 0, priority: 1, normal: 2 };

/** Emergency first, then priority (senior citizens, pregnant…), then token order. */
export function byQueueOrder<T extends { priority: string; token: number; checkedInAt: Date }>(a: T, b: T) {
  return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || a.checkedInAt.getTime() - b.checkedInAt.getTime();
}

/** "12 min" / "1 h 05 m" */
export function waitLabel(min: number) {
  return min < 90 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} m`;
}

/** Minutes since a moment, for "waiting 12 min" badges. */
export function minutesSince(d: Date, now = Date.now()) {
  return Math.max(0, Math.round((now - d.getTime()) / 60_000));
}
