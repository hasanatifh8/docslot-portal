# DocSlot HMS

Hospital management for small and mid-size hospitals: patient registration
(UHID), OPD queue with tokens, vitals, consultation notes and printable
prescriptions, departments, role-based staff logins — plus the original
WhatsApp booking bot, so patients can still book, reschedule and get reminders
entirely in chat.

### Roles

| Role | Can do |
|---|---|
| Administrator | Everything, incl. doctors & departments, staff, settings |
| Receptionist | Register/edit patients, book appointments, OPD check-in |
| Junior doctor | Triage: capture vitals and hand off to the senior doctor |
| Nurse | Register/edit patients, OPD check-in, triage |
| Senior doctor | Consult, prescribe and finalize (own patients only) |

### OPD pipeline

`CHECKED_IN → TRIAGE_IN_PROGRESS → TRIAGE_COMPLETED → IN_CONSULTATION → COMPLETED`
(or `CANCELLED` from any open state). Defined once in `lib/encounter.ts`;
every status change goes through `transition()` in `app/actions/opd.ts`,
which checks role + current state and does a compare-and-set update so two
people can't claim the same patient. Completing renders the prescription PDF
(`lib/prescription-pdf.ts`), stores it on the visit, and serves it from
`/api/visits/[id]/prescription`. Queue and visit screens auto-refresh every 10s.

Permissions live in `lib/rbac.ts`; pages call `requirePermission()` and
actions call it with `{ throwOnDeny: true }`.

Built with Next.js (App Router) + Prisma, on Postgres (Neon free tier works
for both local dev and production).

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # then paste your Neon DATABASE_URL in
npm run db:push               # create the schema
npm run db:seed                # demo hospital — logins below, password demo1234
npm run dev                    # http://localhost:3000
```

Portal: <http://localhost:3000>  ·  Prisma Studio: `npm run db:studio`

Demo logins (password `demo1234`): `demo@docslot.test` (admin),
`reception@docslot.test`, `nurse@docslot.test`, `jr.rao@docslot.test`,
`dr.mehra@docslot.test`.

**Upgrading an existing DocSlot database:** `npm run db:push` (additive —
existing users become admins), then `npx tsx scripts/backfill-uhid.ts` to give
existing patients a UHID.

Without WhatsApp credentials the app runs fine — outbound messages are
logged to the console instead of sent, so you can exercise the portal and
the webhook flow locally.

---

## How the pieces fit

| Piece | Where | Notes |
|---|---|---|
| Portal (auth, config, dashboard) | `app/(app)/*`, `app/login`; hospitals are created by the platform admin at `/admin` (`lib/platform-auth.ts`) | session cookie auth, `lib/auth.ts`, roles in `lib/rbac.ts` |
| Patients | `app/(app)/patients/*`, `app/actions/patients.ts` | UHID sequence in `lib/patients.ts` |
| OPD | `app/(app)/opd/*`, `app/actions/opd.ts`, `lib/encounter.ts` | state machine; PDF at `/api/visits/[id]/prescription` |
| Staff | `app/(app)/staff`, `app/actions/staff.ts` | admin-only user management |
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

## Deploying (free stack: Vercel + Neon + cron-job.org)

1. **Database — [Neon](https://neon.tech) free tier:** create a project, copy
   its pooled connection string into `DATABASE_URL`.
2. **Host — [Vercel](https://vercel.com) free (Hobby) tier:** import this
   GitHub repo, set env vars (`DATABASE_URL`, `APP_URL` = your `*.vercel.app`
   URL, `CRON_SECRET`, and `WHATSAPP_*` / `SHARED_WHATSAPP_NUMBER` once you
   have them), deploy.
3. Apply the schema to the live database once:
   `DATABASE_URL=<neon url> npx prisma db push`
4. **Reminders — external cron (Vercel Hobby cron only runs once/day, too
   coarse for reminders):** point a free scheduler like
   [cron-job.org](https://cron-job.org) at
   `https://YOUR_APP.vercel.app/api/cron/reminders?secret=<CRON_SECRET>`
   every 5 minutes. (`CRON_SECRET` — generate with `openssl rand -hex 32`.)
5. WhatsApp webhook (once you connect Meta, see above): callback URL is
   `https://YOUR_APP.vercel.app/api/whatsapp/webhook`.

Any other Node.js host works too (Railway, Render, Fly, a VPS) — in that
case you can run `npm run reminders` on a real crontab instead of step 4.

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
