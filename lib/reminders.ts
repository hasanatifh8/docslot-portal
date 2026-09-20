// Shared reminder-sending logic — called from scripts/reminders.ts (local
// cron/crontab) and from app/api/cron/reminders/route.ts (hosted free cron
// hitting the deployed URL, since Vercel Hobby cron only fires once/day).
import { prisma } from "./db";
import { envCredentials, sendText, sendTemplate, type WaCredentials } from "./whatsapp";
import { formatInTimeZone } from "date-fns-tz";

const TEMPLATE = process.env.REMINDER_TEMPLATE_NAME || "";
const TEMPLATE_LANG = process.env.REMINDER_TEMPLATE_LANG || "en";

function credsFor(clinic: { whatsappPhoneNumberId: string | null; whatsappToken: string | null }): WaCredentials {
  if (clinic.whatsappPhoneNumberId && clinic.whatsappToken) {
    return { phoneNumberId: clinic.whatsappPhoneNumberId, token: clinic.whatsappToken };
  }
  return envCredentials();
}

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

  return { due: due.length, sent, failed };
}
