// Shared reminder-sending logic — called from scripts/reminders.ts (local
// cron/crontab) and from app/api/cron/reminders/route.ts (hosted free cron
// hitting the deployed URL, since Vercel Hobby cron only fires once/day).
import { prisma } from "./db";
import { sendText, sendTemplate } from "./whatsapp";
import { credsFor } from "./notify";
import { formatInTimeZone } from "date-fns-tz";

const TEMPLATE = process.env.REMINDER_TEMPLATE_NAME || "";
const TEMPLATE_LANG = process.env.REMINDER_TEMPLATE_LANG || "en";


export async function sendDueReminders() {
  const due = await prisma.reminder.findMany({
    where: { sentAt: null, sendAt: { lte: new Date() } },
    include: {
      appointment: { include: { clinic: true, doctor: true, patient: true } },
    },
    orderBy: { sendAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let failed = 0;

  for (const r of due) {
    const a = r.appointment;
    if (a.status !== "booked") {
      await prisma.reminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      continue;
    }

    const tz = a.clinic.timezone;
    const when = formatInTimeZone(a.startAt, tz, "EEE, d MMM · h:mm a");
    const creds = credsFor(a.clinic);

    try {
      if (TEMPLATE) {
        await sendTemplate(creds, a.patient.waPhone, TEMPLATE, TEMPLATE_LANG, [
          a.clinic.name,
          a.doctor.name,
          when,
        ]);
      } else {
        await sendText(
          creds,
          a.patient.waPhone,
          `⏰ Reminder: appointment with ${a.doctor.name} at ${a.clinic.name}\n📅 ${when}\n\nReply *reschedule* or *cancel* if needed.`
        );
      }
      await prisma.reminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      sent++;
    } catch (err) {
      console.error(`[reminders] failed ${r.id}`, err);
      failed++;
    }
  }

  const followUps = await sendFollowUpReminders();
  return { due: due.length, sent, failed, followUps };
}

/**
 * The day before a doctor-advised follow-up, nudge the patient on WhatsApp —
 * unless they've already booked or been seen again.
 */
async function sendFollowUpReminders() {
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const day = new Date(`${tomorrow.toISOString().slice(0, 10)}T00:00:00Z`);
  const visits = await prisma.visit.findMany({
    where: { status: "COMPLETED", followUpDate: day, followUpRemindedAt: null, followUpClosedAt: null },
    select: {
      id: true,
      completedAt: true,
      followUpDate: true,
      clinic: true,
      doctor: { select: { name: true } },
      patient: { select: { name: true, waPhone: true, appointments: { where: { status: "booked" }, select: { createdAt: true } } } },
    },
    take: 100,
  });
  let sent = 0;
  for (const v of visits) {
    if (v.patient.appointments.some((a) => v.completedAt && a.createdAt > v.completedAt)) continue;
    try {
      const res = await sendText(
        credsFor(v.clinic),
        v.patient.waPhone,
        `🔔 ${v.clinic.name}\n\nHi ${v.patient.name ?? ""}, your follow-up with ${v.doctor.name} is due tomorrow (${formatInTimeZone(v.followUpDate!, "UTC", "EEE, d MMM")}).\n\nReply *hi* to book a time.`
      );
      if ((res as { skipped?: boolean }).skipped) continue; // WhatsApp not connected
      await prisma.visit.update({ where: { id: v.id }, data: { followUpRemindedAt: new Date() } });
      sent++;
    } catch (err) {
      console.error(`[reminders] follow-up ${v.id} failed`, err);
    }
  }
  return sent;
}
