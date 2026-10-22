# DocSlot HMS — UX design & feature guide

How each module works for the people using it, why it is laid out the way it
is, and how it prevents mistakes. Written for the product team and developers
extending the app.

---

## 1. Design system

| Element | Decision | Why |
|---|---|---|
| Typeface | Plus Jakarta Sans (app-wide, `app/layout.tsx`), tabular figures for tokens, money and vitals (`.tabular`) | Same face as the login page; numbers line up in queues and bills |
| Colour | Clinical teal `brand-*` (from the logo) for actions; orange `accent-*` used sparingly; status colours reserved: **rose** = critical/emergency/allergy, **amber** = abnormal/late/money due, **emerald** = normal/paid | Status colours always come with a word ("Critical", "Paid", "Late"), never colour alone |
| Spacing & shape | 16 px cards (`rounded-2xl`), 8–12 px controls, 40 px default control height, 48 px for primary "commit" actions | Large touch targets for tablets at the front desk and doctor's desk |
| Micro-interactions | Toasts for every save, step slide-in, dialog scale-in, pulsing outline on critical vitals / emergency banner; all disabled under `prefers-reduced-motion` | Feedback without blocking the next action |
| Accessibility | Visible focus ring everywhere, `aria-invalid` styling, `role="alert"` for errors, combobox/listbox roles on auto-completes, labels on every input | Front desk works mostly on the keyboard |

Shared building blocks live in `components/ui.tsx` (`Button`, `Chip`, `Banner`,
`Field`, `KeyValue`, `tw()` class merge), `components/wizard.tsx`
(`WizardSteps`, `WizardFooter`), `components/toast.tsx`,
`components/autocomplete.tsx`, `components/voice-input.tsx`.

## 2. Navigation

- **Sidebar grouped by job**: Front desk (Dashboard, OPD queue, Appointments,
  Patients, Follow-ups) → Billing → Insights (Reports, Audit) → Administration.
  Each role only sees what it can use (`components/nav-items.ts` + `lib/rbac.ts`).
- **Top bar on every page**:
  - **Search (Ctrl/⌘ + K)** — one box for patients (name, UHID, phone) and
    actions ("Book appointment", "Go to Billing"). Arrow keys + Enter.
  - **+ New** — Register patient, Book appointment, OPD check-in, from anywhere.
- **Dashboard "needs attention" strip** — emergencies, patients waiting over
  45 min, money to collect, follow-ups due, doctors on leave; each is a link.
- **Every flow ends with the next likely step** (e.g. after registration:
  "Check in now", "Book appointment", "Add another family member").

## 3. Modules

### 3.1 Patient registration (`/patients/new`)

**Flow — 5 steps:** Phone → Patient → Contact & ID → Medical → Review.

| Step | What happens | Smart defaults / less typing |
|---|---|---|
| Phone | Shows everyone already registered on that number, each with *Check in* / *Open* | 10-digit mobile gets +91 automatically |
| Patient | Name, gender chips, age **or** DOB, relation, blood group chips | Name auto-capitalised; "Self" pre-selected when the number is new; age in years is enough |
| Contact & ID | Address, email, emergency contact, Aadhaar/ABHA/PAN | Whole step is skippable ("Skip") |
| Medical | Allergies and chronic conditions as chips + free text | Common items one tap; "No known allergies" chip |
| Review | Summary cards with *Edit* links to each step | — |

**Error prevention**
- Families can share a number (no more "phone already registered" dead end);
  a live **possible-duplicate** banner appears when the name matches someone on
  the same number or birth date, with a link to the existing record.
- An exact repeat (same number + name + DOB) is blocked on the server.
- Inline validation per step (Aadhaar 12 digits, ABHA 14, PAN format, email,
  emergency phone); the step can't advance with errors; jumping back via the
  step header keeps everything typed.

**Quick register** (inside booking / check-in / billing pickers): name, mobile,
gender, age — three fields, full details later.

### 3.2 Appointments (`/appointments`, `/appointments/new`)

**Booking flow — 4 steps:** Patient → Doctor → Date & time → Confirm.

- Patient step: live search with keyboard navigation, or quick register.
- Doctor step: cards filterable by department; the patient's **last doctor is
  pre-selected** and tagged "Seen last time".
- Date step: 14-day strip with **free-slot counts** (green/amber/"Full"); the
  earliest day with room is pre-selected. Slots grouped Morning / Afternoon /
  Evening; taken slots are visible but struck through and disabled.
- Confirm: reason chips ("Follow-up", "Report review"…), WhatsApp confirmation
  toggle (on by default).
- **Reschedule** uses the same wizard (`?reschedule=<id>`) with patient and
  doctor fixed; the old booking is cancelled only when the new one succeeds.

**Day view** (`/appointments`): previous/today/next + date jump, doctor and
status filters, per-row *Check in / Reschedule / No-show / Cancel*; overdue
bookings are marked **Late**.

**Error prevention:** slots are re-checked on the server at submit (someone may
have taken it) — the user is sent back to the slot grid with a fresh list.
Doctor leave and hospital holidays are never offered.

### 3.3 OPD check-in & queue (`/opd`)

**Check-in drawer** (opens over the queue; also from patient profile, "+ New",
or `?checkin=1`):

1. Patient (search / quick register) — allergies shown immediately.
2. Doctor cards with **live "N waiting"** counts; last doctor pre-selected.
3. Reason chips + priority (Normal / Priority / **Emergency**).
4. **Fee decided by the system**: new visit vs follow-up within the doctor's
   follow-up window (e.g. "Seen 6 days ago — ₹0"). Pay now (Cash/UPI/Card +
   reference) or *Pay later*.

Result: a large token number, room, and amount collected, with
"Check in next patient" focused for the next person in line.

**Queue:** pipeline counters, lanes ordered by what the viewer acts on next
(doctors see "Ready for doctor" first), **emergency → priority → token**
ordering, waiting-time badge that turns amber/red, "₹ due", "Critical vitals",
"ALLERGY" tags, auto-refresh every 10 s.

**Token display** (`/display`): full-screen TV view per doctor — Now serving,
Next 5, room number. Shows **tokens only, never names**.

**Error prevention:** a patient already in today's queue can't be checked in
twice (the drawer links to the open visit); status changes are
compare-and-set, so two people can't take the same patient.

### 3.4 Triage (`/opd/[id]`, nurse / junior doctor)

- Large numeric inputs with units; numeric keyboard on tablets.
- **Live validation per vital:** values outside physiological limits are
  blocked ("Check value 5–60"); abnormal → amber "High/Low"; critical → red,
  pulsing, plus a "Critical reading — inform the doctor now" banner.
- BMI and its band calculate automatically.
- "Complete triage" stays disabled until BP, pulse, SpO₂ and temperature are in
  and nothing is invalid; the hint says exactly what's missing.

### 3.5 Doctor consultation (`/opd/[id]`, senior doctor)

One page in consultation order, with a live **clinical summary** pinned on the
right (desktop) or below (tablet/phone).

| Speed feature | How it works |
|---|---|
| Templates | Personal or shared presets (complaint, exam, diagnosis + ICD, advice, Rx); one tap applies; "Save current as template" |
| One-tap phrases | Complaint, examination and advice chips append text |
| Dictation | Mic on every free-text field (Web Speech API, en-IN); text lands in the field for review |
| Diagnosis | Type words or a code — ICD-10 suggestions fill title + code |
| Prescription | Drug auto-complete fills dose / frequency / duration / instructions; the doctor's **10 most-prescribed lines** appear as one-tap chips; "Repeat last Rx" |
| Follow-up | 3 days / 1 week / 2 weeks / 1 month / 3 months chips |
| Keyboard | Ctrl/⌘+S saves a draft, Ctrl/⌘+Enter opens Finalize |
| Auto-save | Draft saved every 40 s while there are changes; warning before leaving with unsaved work |

**Error prevention:** allergy check on every medicine (including drug classes —
penicillin → amoxicillin/augmentin, NSAIDs, sulfa, cephalosporins…); the row
turns red and the finalize dialog repeats the warning. Diagnosis is required.
Finalize shows the full summary for a last check and the "Send on WhatsApp"
option. After signing, the record is locked — corrections go in as
**addenda** with author and time (the signed PDF is never altered).

**After the visit:** Open/print/download PDF, **Send on WhatsApp** (signed
patient link, `/rx/<id>?s=…`), previous visits with diagnoses and Rx.

### 3.6 Billing (`/billing`, `/billing/[id]`, `/billing/day-end`)

- Consultation bill is created **automatically at check-in**; the counter
  only collects.
- List: today's "To collect" first (plus older unpaid), KPIs (collected by
  mode, due, bills raised), day navigation.
- Bill page: charges table, **one-tap price-list services**, "Other charge";
  sticky summary with balance; **Collect** panel (amount defaults to the
  balance, quick-cash buttons work out change, UPI/card reference).
- Admin-only adjustments behind a disclosure: discount (10/20/50/100 % quick
  picks), refund, void — each **requires a reason** and is audited.
- **Receipt** (`/receipt/<id>`) — A5-friendly, printable.
- **Day-end cash report** — collections by staff × payment mode, refunds, every
  transaction; printable.

**Error prevention:** can't receive more than is due; can't remove items once
paid (refund instead); can't discount below what's already paid; can't void a
bill with payments; fees are always computed on the server.

### 3.7 Follow-ups (`/follow-ups`)

Tabs: **Overdue / Due today / Next 7 days / Already booked**. Each row: patient,
doctor, last diagnosis, due date, **Book** (wizard pre-filled with patient and
doctor), **WhatsApp reminder**, **Done**. Follow-ups close automatically when the
patient checks in or books. The reminder job also messages patients the day
before their follow-up (`lib/reminders.ts`).

### 3.8 Reports & audit

- **Reports** (`/reports`, admin): Today / 7 / 30 days / month or custom range;
  patients seen (new vs follow-up), net collections and outstanding, average
  wait to doctor and consultation time, no-show rate, WhatsApp share; visits per
  day chart (with table view), top diagnoses, by-doctor and by-department
  tables; **CSV export** of visits and payments (opens in Excel).
- **Audit log** (`/audit`, admin): read-only list of every change — who, what,
  when — filterable by area and searchable.

### 3.9 Administration & security

- Doctors: room, consultation / follow-up fee, follow-up window, working hours,
  **leave** (blocks slots everywhere; "Cancel N bookings & notify patients").
  Doctors with history can't be deleted (deactivate instead).
- Settings: hospital details & reception phone, **service price list**, closed
  days, own WhatsApp number (token stored, never shown again).
- Staff get a temporary password and **must set their own on first sign-in**;
  everyone can change their password from the key icon (`/account`).
- Platform admin (`/admin`) can **suspend / reactivate** a hospital (its staff
  are signed out immediately).

### 3.10 Finance, forecasting & reports (admin, accountant)

- **Finance** (`/finance`): month picker; KPIs with like-for-like change vs
  last month (collected, expenses, net profit & margin, patients, revenue per
  visit, outstanding dues); **daily collections with a 14-day forecast** and
  likely range; **target ring** with projected month-end (target set in
  Settings); **OPD capacity** booked for the next 7 days; 12-month collections
  vs expenses (with table view and P&L CSV); revenue by doctor and service;
  payment-mode mix; expenses by category.
- **Expenses** (`/finance/expenses`): category chips, amount, date, mode,
  vendor, bill no.; recurring entries (rent, salaries) are offered for copying
  into the next month in one click.
- **Forecasting** (`lib/forecast.ts`): same-weekday average of the last 6
  weeks × recent trend (±25 %), with an ≈80 % range; closed weekdays and
  holidays are left blank. Simple enough to explain to an owner.
- **Reports** (`/reports`): patient volume (new vs follow-up) with forecast,
  busiest-hours heat map for staffing, doctor and department tables.
- **Daily report** (`/reports/daily`) and **Monthly P&L** (`/reports/monthly`):
  printable, with cash-to-bank reconciliation and previous-month comparison.
- **Accountant role**: billing, finance, expenses and reports — no clinical data.
- Charts follow one-axis, thin-mark, legend-for-2+-series rules; colours are
  validated for colour-blind safety (`lib/chart-palette.ts`); every chart has
  hover detail and a table or labelled values.

### 3.11 Sales website (`/`)

Logged-out visitors see the product site: hero with live screenshots,
features, front-desk / doctor / owner showcases, onboarding steps, pricing
(edit `PLANS` in `app/page.tsx`), FAQ and a **Book a demo** form. Requests are
stored as leads and listed, with status, on the platform admin page (`/admin`).

## 4. Responsive behaviour

| Width | Layout |
|---|---|
| Phone (< 768 px) | Sidebar becomes a drawer (☰); top bar keeps Search + New; wizards show "Step 2 of 5" with a progress bar; chips scroll horizontally; tables become stacked rows; check-in opens full-screen |
| Tablet (768–1279 px) | Sidebar visible; two-column cards; consultation summary moves below the form |
| Desktop (≥ 1280 px) | Consultation with sticky summary column; bill page with sticky totals |

All main screens were checked at 375 px with no horizontal scrolling.

## 5. Not in this release (next phases)

IPD / beds / discharge summary, pharmacy & inventory, lab/radiology orders,
insurance / TPA, ABDM/ABHA integration, two-factor login, patient portal.
