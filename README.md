# DocSlot Portal

WhatsApp appointment booking for clinics — the self-serve trial portal.
A clinic signs up, configures its doctors and hours, and gets a WhatsApp
booking link. Patients book, reschedule, and get reminders entirely in chat.

Built with Next.js (App Router) + Prisma. Local dev uses SQLite (zero setup);
production uses Postgres.

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # defaults work for local dev
npm run db:push               # create the SQLite schema
npm run db:seed                # demo clinic — login demo@docslot.test / demo1234
npm run dev                    # http://localhost:3000
```

Portal: <http://localhost:3000>  ·  Prisma Studio: `npm run db:studio`

Without WhatsApp credentials the app runs fine — outbound messages are
logged to the console instead of sent, so you can exercise the portal and
the webhook flow locally.

---

## How the pieces fit

| Piece | Where | Notes |
|---|---|---|
| Portal (auth, config, dashboard) | `app/(app)/*`, `app/login`, `app/signup` | session cookie auth, `lib/auth.ts` |
| Booking conversation | `lib/conversation.ts` | explicit state machine, one `Conversation` row per patient phone |
| WhatsApp webhook | `app/api/whatsapp/webhook/route.ts` | GET = Meta verify, POST = inbound messages |
| WhatsApp API client | `lib/whatsapp.ts` | Cloud API (text / list / buttons / template) |
| Slot engine | `lib/slots.ts` | pure functions — config + busy intervals → bookable slots |
| Reminder worker | `scripts/reminders.ts` | run on a cron; sends 24h / 2h reminders |
| Data model | `prisma/schema.prisma` | Clinic is the tenant |

### Multi-tenancy

- **Shared demo number phase:** every clinic sends/receives through one
  WhatsApp number (env `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_TOKEN`).
  A patient's first message must be the **clinic code** (e.g. `sunrise`) so
  the bot knows which clinic — the portal's Settings page shows each clinic a
  ready-made `wa.me` link with its code pre-filled.
- **Own-number phase:** a clinic pastes its own phone number ID + token in
  Settings. Inbound webhooks are then routed to it by `phone_number_id`, no
  code needed.

---

## Connecting WhatsApp (Meta Cloud API)

1. **Meta Business Manager** → **developers.facebook.com** → create an app →
   add the **WhatsApp** product.
2. Under WhatsApp → API Setup, note the **Phone number ID** and a token.
   The auto-provided **test number** can message up to 5 verified recipients
   for free — enough for demos. For a real demo number, add your own SIM
   (it can no longer be used in the WhatsApp app once on the API).
3. Set a **display name** and submit it for review.
4. Put the values in `.env`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_TOKEN=...
   WHATSAPP_VERIFY_TOKEN=some-string-you-choose
   SHARED_WHATSAPP_NUMBER=15551234567     # digits, with country code
   ```
5. Deploy (see below) so the webhook has a public HTTPS URL.
6. In Meta → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://YOUR_DOMAIN/api/whatsapp/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
7. **Reminder template:** create a template in Meta (category *Utility*) with
   3 body variables — clinic name, doctor name, date/time — wait for approval,
   then set `REMINDER_TEMPLATE_NAME` / `REMINDER_TEMPLATE_LANG` in the env.
   Until then reminders fall back to plain text (only delivered if the patient
   messaged within 24h).

---

## Deploying

1. Provision Postgres (Neon / Supabase / RDS).
2. In `prisma/schema.prisma` change `datasource db { provider = "postgresql" }`.
3. Set `DATABASE_URL` to the Postgres URL, plus all the `WHATSAPP_*` and
   `APP_URL` / `SHARED_WHATSAPP_NUMBER` vars.
4. `npx prisma migrate deploy` (or `prisma db push` for the first cut).
5. Host the web app anywhere that runs Next.js (Railway, Render, Fly, a VPS).
6. Schedule the reminder worker every ~5 min:
   ```
   */5 * * * *  cd /app && npm run reminders
   ```
   (Railway cron, Render cron job, or a system crontab.)

---

## npm scripts

| Script | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run db:push` | apply schema to the database |
| `npm run db:seed` | insert the demo clinic |
| `npm run db:studio` | Prisma Studio |
| `npm run reminders` | send due reminders once |

---

## Booking flow (what the patient sees)

```
patient: sunrise                     ← clinic code (shared number only)
bot:     [list] Choose doctor
patient: (taps Dr. Mehra)
bot:     [list] Pick a day
patient: (taps Fri, 12 Sep)
bot:     [list] Available times
patient: (taps 11:30)
bot:     And your full name?
patient: Rahul Verma
bot:     [Confirm] [Cancel]  — summary
patient: (taps Confirm)
bot:     ✅ Booked! …address, prep info…
```

Keywords any time: **hi** restart · **cancel** cancel next appointment ·
**reschedule** move next appointment.
