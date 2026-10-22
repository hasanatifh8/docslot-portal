import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { byQueueOrder } from "@/lib/queue";
import { AutoRefresh } from "@/components/visit-status";
import { Logo } from "@/components/brand";

export const metadata = { title: "Token display · DocSlot" };

/**
 * Waiting-room TV. Open on a screen signed in as any staff member, press F11.
 * Shows tokens and rooms only — never patient names (privacy).
 */
export default async function TokenDisplayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tz = user.clinic.timezone;
  const { start, end } = dayRange(tz);

  const [doctors, visits] = await Promise.all([
    prisma.doctor.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" } }),
    prisma.visit.findMany({
      where: { clinicId: user.clinicId, checkedInAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      select: { id: true, doctorId: true, token: true, status: true, priority: true, checkedInAt: true, consultStartedAt: true },
    }),
  ]);

  const boards = doctors
    .map((d) => {
      const mine = visits.filter((v) => v.doctorId === d.id);
      const now = mine.filter((v) => v.status === "IN_CONSULTATION").sort((a, b) => (b.consultStartedAt?.getTime() ?? 0) - (a.consultStartedAt?.getTime() ?? 0))[0];
      const ready = mine.filter((v) => v.status === "TRIAGE_COMPLETED").sort(byQueueOrder);
      const waiting = mine.filter((v) => v.status === "CHECKED_IN" || v.status === "TRIAGE_IN_PROGRESS").sort(byQueueOrder);
      return { d, now, next: [...ready, ...waiting].slice(0, 5), waiting: ready.length + waiting.length };
    })
    .filter((b) => b.now || b.waiting > 0 || visits.some((v) => v.doctorId === b.d.id));

  return (
    <div className="flex min-h-dvh flex-col bg-[#061a1e] text-white">
      <AutoRefresh seconds={5} />
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white px-3 py-1.5">
            <Logo className="h-7" />
          </div>
          <span className="text-lg font-semibold text-teal-100 lg:text-2xl">{user.clinic.name}</span>
        </div>
        <div className="text-right">
          <div className="tabular text-2xl font-bold lg:text-4xl">{fmt(new Date(), tz, "h:mm a")}</div>
          <div className="text-xs text-teal-200/70 lg:text-sm">{fmt(new Date(), tz, "EEEE, d MMMM")}</div>
        </div>
      </header>

      {boards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-2xl text-teal-100/60">OPD queue is empty</div>
      ) : (
        <main className="grid flex-1 grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:p-10 xl:grid-cols-3">
          {boards.map(({ d, now, next, waiting }) => (
            <section key={d.id} className="flex flex-col overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3 bg-teal-500/15 px-6 py-4">
                <div className="min-w-0">
                  <div className="truncate text-xl font-bold lg:text-2xl">{d.name}</div>
                  <div className="truncate text-sm text-teal-100/70">{d.specialty}</div>
                </div>
                {d.room && (
                  <div className="shrink-0 rounded-2xl bg-white px-4 py-2 text-center text-[#061a1e]">
                    <div className="text-[10px] font-bold tracking-widest uppercase">Room</div>
                    <div className="text-2xl leading-none font-extrabold">{d.room}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-5 p-6">
                <div>
                  <div className="text-xs font-semibold tracking-[0.2em] text-teal-200/70 uppercase">Now serving</div>
                  <div className={`tabular mt-1 text-7xl leading-none font-extrabold lg:text-8xl ${now ? "text-amber-300" : "text-white/20"}`}>{now ? now.token : "—"}</div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold tracking-[0.2em] text-teal-200/70 uppercase">
                    Next · {waiting} waiting
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next.length === 0 && <span className="text-white/30">—</span>}
                    {next.map((v, i) => (
                      <span
                        key={v.id}
                        className={`tabular rounded-xl px-4 py-2 text-2xl font-bold lg:text-3xl ${
                          v.priority === "emergency" ? "bg-rose-500 text-white" : i === 0 ? "bg-teal-400 text-[#061a1e]" : "bg-white/10 text-white"
                        }`}
                      >
                        {v.token}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </main>
      )}
      <footer className="px-6 pb-4 text-center text-xs text-white/40 lg:px-10">Please wait for your token to be called · Emergency cases are seen first</footer>
    </div>
  );
}
