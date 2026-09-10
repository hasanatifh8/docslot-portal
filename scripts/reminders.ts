/**
 * Reminder worker — run on a schedule (cron every 5 min, or a hosted cron job):
 *   npx tsx scripts/reminders.ts
 *
 * Sends any reminder whose sendAt has passed. Outside WhatsApp's 24h window a
 * plain text message is rejected by Meta, so reminders go as an approved
 * TEMPLATE when REMINDER_TEMPLATE_NAME is set. In local testing (recipient
 * messaged you recently) it falls back to plain text.
 *
 * Template body must have 3 {{n}} params in this order:
 *   {{1}} clinic name   {{2}} doctor name   {{3}} date & time
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import {
  envCredentials,
  sendText,
  sendTemplate,
  type WaCredentials,
} from "../lib/whatsapp";
import { formatInTimeZone } from "date-fns-tz";

const TEMPLATE = process.env.REMINDER_TEMPLATE_NAME || "";
const TEMPLATE_LANG = process.env.REMINDER_TEMPLATE_LANG || "en";

function credsFor(clinic: { whatsappPhoneNumberId: string | null; whatsappToken: string | null }): WaCredentials {
  if (clinic.whatsappPhoneNumberId && clinic.whatsappToken) {
    return { phoneNumberId: clinic.whatsappPhoneNumberId, token: clinic.whatsappToken };
  }
  return envCredentials();
}

async function main() {
  const due = await prisma.reminder.findMany({
    where: { sentAt: null, sendAt: { lte: new Date() } },
    include: {
      appointment: { include: { clinic: true, doctor: true, patient: true } },
    },
    orderBy: { sendAt: "asc" },
    take: 100,
  });

  console.log(`[reminders] ${due.length} due`);

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
      console.log(`[reminders] sent ${r.id} -> ${a.patient.waPhone}`);
    } catch (err) {
      console.error(`[reminders] failed ${r.id}`, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
