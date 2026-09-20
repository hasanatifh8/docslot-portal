/**
 * Reminder worker — run on a schedule (cron every 5 min, or a hosted cron job):
 *   npx tsx scripts/reminders.ts
 *
 * Sends any reminder whose sendAt has passed. Outside WhatsApp's 24h window a
 * plain text message is rejected by Meta, so reminders go as an approved
 * TEMPLATE when REMINDER_TEMPLATE_NAME is set. In local testing (recipient
 * messaged you recently) it falls back to plain text.
 *
 * On a host without crontab access (e.g. Vercel), hit
 * GET /api/cron/reminders instead — see app/api/cron/reminders/route.ts.
 */
import "dotenv/config";
import { sendDueReminders } from "../lib/reminders";

sendDueReminders()
  .then(({ due, sent, failed }) => {
    console.log(`[reminders] ${due} due, ${sent} sent, ${failed} failed`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
