import { prisma } from "@/lib/db";
import {
  InboundMessage,
  WaCredentials,
  envCredentials,
  sendText,
  sendList,
  sendButtons,
} from "@/lib/whatsapp";
import {
  generateSlots,
  upcomingWorkingDates,
  dayLabel,
  minToHHMM,
} from "@/lib/slots";
import { formatInTimeZone } from "date-fns-tz";
import { ensureUhid } from "@/lib/patients";
import { closedDates } from "@/lib/availability";

// The booking flow is a small explicit state machine. State lives in the
// Conversation row (step + draft JSON). Each inbound message advances it.

type Draft = {
  doctorId?: string;
  date?: string;
  startAt?: string; // ISO
  endAt?: string; // ISO
  patientName?: string;
  // Chosen family member (several patients can share one WhatsApp number)
  patientId?: string;
  rescheduleOf?: string; // appointment id being moved
};

const RESTART_WORDS = ["hi", "hello", "hey", "book", "menu", "start", "namaste"];
const CANCEL_WORDS = ["cancel", "cancel appointment"];
const RESCHEDULE_WORDS = ["reschedule", "change", "change appointment"];

function creds(clinic: { whatsappPhoneNumberId: string | null; whatsappToken: string | null }): WaCredentials {
  if (clinic.whatsappPhoneNumberId && clinic.whatsappToken) {
    return { phoneNumberId: clinic.whatsappPhoneNumberId, token: clinic.whatsappToken };
  }
  return envCredentials();
}

async function getConversation(waPhone: string) {
  return prisma.conversation.upsert({
    where: { waPhone },
    create: { waPhone },
    update: {},
  });
}

async function setState(waPhone: string, step: string, draft: Draft) {
  await prisma.conversation.update({
    where: { waPhone },
    data: { step, draft: JSON.stringify(draft) },
  });
}

async function reminderRows(appointmentId: string, startAt: Date, offsets: number[]) {
  const rows = offsets
    .map((offsetMinutes) => ({
      appointmentId,
      offsetMinutes,
      sendAt: new Date(startAt.getTime() - offsetMinutes * 60_000),
    }))
    .filter((r) => r.sendAt.getTime() > Date.now());
  if (rows.length) await prisma.reminder.createMany({ data: rows });
}

// ─── Entry point ───────────────────────────────────────────────────────────

export async function handleInbound(msg: InboundMessage): Promise<void> {
  const { from } = msg;
  const body = (msg.text || "").trim();
  const lower = body.toLowerCase();

  const convo = await getConversation(from);

  // Resolve the clinic: dedicated number wins, else the conversation's bound
  // clinic, else treat the first message as a clinic code.
  let clinic =
    (msg.phoneNumberId
      ? await prisma.clinic.findUnique({ where: { whatsappPhoneNumberId: msg.phoneNumberId } })
      : null) ?? (convo.clinicId ? await prisma.clinic.findUnique({ where: { id: convo.clinicId } }) : null);

  if (!clinic) {
    const code = lower.split(/\s+/)[0]?.replace(/[^a-z0-9-]/g, "");
    if (code) clinic = await prisma.clinic.findUnique({ where: { code } });
    if (!clinic) {
      await sendText(
        envCredentials(),
        from,
        "Welcome to DocSlot 👋\nPlease send your clinic's booking code to begin (for example: sunrise)."
      );
      return;
    }
    await prisma.conversation.update({ where: { waPhone: from }, data: { clinicId: clinic.id } });
  }

  const c = creds(clinic);
  const tz = clinic.timezone;
  const draft: Draft = safeParse(convo.step === "start" ? "{}" : convo.draft);

  // ── Global commands ──────────────────────────────────────────────────────
  if (RESTART_WORDS.includes(lower)) {
    return startBooking(clinic, from, c, tz, {});
  }
  if (CANCEL_WORDS.includes(lower)) {
    return doCancel(clinic, from, c, tz);
  }
  if (RESCHEDULE_WORDS.includes(lower)) {
    return startReschedule(clinic, from, c, tz);
  }

  // ── Step machine ─────────────────────────────────────────────────────────
  switch (convo.step) {
    case "choose_doctor": {
      const doctor = await prisma.doctor.findFirst({
        where: { id: body, clinicId: clinic.id, active: true },
      });
      if (!doctor) return startBooking(clinic, from, c, tz, draft);
      draft.doctorId = doctor.id;
      return offerDays(clinic, from, c, tz, draft);
    }

    case "choose_day": {
      draft.date = body;
      return offerSlots(clinic, from, c, tz, draft);
    }

    case "choose_slot": {
      // body is "<startISO>|<endISO>"
      const [s, e] = body.split("|");
      if (!s || !e) return offerSlots(clinic, from, c, tz, draft);
      draft.startAt = s;
      draft.endAt = e;
      // Rescheduling keeps the same patient.
      if (draft.patientId) return askConfirm(clinic, from, c, tz, draft);
      return askWhichPatient(clinic, from, c, draft);
    }

    case "choose_cancel":
      return doCancel(clinic, from, c, tz, body);

    case "choose_reschedule":
      return startReschedule(clinic, from, c, tz, body);

    case "choose_patient": {
      if (body === "new_person") {
        await setState(from, "ask_name", draft);
        await sendText(c, from, "What is the patient's full name?");
        return;
      }
      const patient = await prisma.patient.findFirst({ where: { id: body, clinicId: clinic.id, waPhone: from } });
      if (!patient) return askWhichPatient(clinic, from, c, draft);
      draft.patientId = patient.id;
      draft.patientName = patient.name ?? undefined;
      return askConfirm(clinic, from, c, tz, draft);
    }

    case "ask_name": {
      draft.patientName = body.slice(0, 80);
      return askConfirm(clinic, from, c, tz, draft);
    }

    case "confirm": {
      if (body === "confirm_yes") return finalizeBooking(clinic, from, c, tz, draft, msg.contactName);
      if (body === "confirm_no") {
        await setState(from, "done", {});
        await sendText(c, from, "No problem — nothing booked. Send *hi* whenever you'd like to try again.");
        return;
      }
      return askConfirm(clinic, from, c, tz, draft);
    }

    default: {
      // start / done / unknown → begin a fresh booking
      return startBooking(clinic, from, c, tz, {});
    }
  }
}

// ─── Steps ─────────────────────────────────────────────────────────────────

/** Families share numbers: ask who the booking is for (or take a new name). */
async function askWhichPatient(clinic: any, from: string, c: WaCredentials, draft: Draft): Promise<void> {
  const family = await prisma.patient.findMany({
    where: { clinicId: clinic.id, waPhone: from, name: { not: null } },
    orderBy: { createdAt: "asc" },
    take: 9,
  });
  if (family.length === 0) {
    await setState(from, "ask_name", draft);
    await sendText(c, from, "And the patient's full name for the appointment?");
    return;
  }
  await setState(from, "choose_patient", draft);
  await sendList(c, from, {
    header: "Who is the appointment for?",
    body: "Pick the patient:",
    button: "Choose patient",
    rows: [
      ...family.map((p) => ({ id: p.id, title: (p.name ?? "Patient").slice(0, 24), description: p.uhid ?? undefined })),
      { id: "new_person", title: "Someone else", description: "Book for a new family member" },
    ],
  });
}

async function startBooking(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  draft: Draft
): Promise<void> {
  const doctors = await prisma.doctor.findMany({
    where: { clinicId: clinic.id, active: true },
    orderBy: { name: "asc" },
  });
  if (doctors.length === 0) {
    await sendText(c, from, `${clinic.name} hasn't added any doctors yet. Please try again later.`);
    return;
  }

  if (doctors.length === 1) {
    draft.doctorId = doctors[0].id;
    return offerDays(clinic, from, c, tz, draft);
  }

  await setState(from, "choose_doctor", draft);
  await sendList(c, from, {
    header: clinic.name,
    body: "Who would you like to see?",
    button: "Choose doctor",
    rows: doctors.map((d) => ({
      id: d.id,
      title: d.name.slice(0, 24),
      description: d.specialty.slice(0, 72),
    })),
  });
}

async function offerDays(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  draft: Draft
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: draft.doctorId! },
    include: { workingHours: true },
  });
  if (!doctor) return startBooking(clinic, from, c, tz, {});

  const holidays = await closedDates(clinic.id, doctor.id, tz);
  const dates = upcomingWorkingDates({
    timezone: tz,
    workingHours: doctor.workingHours,
    holidays,
    count: 7,
  });
  if (dates.length === 0) {
    await sendText(c, from, `${doctor.name} has no open days in the next few weeks. Please check back later.`);
    return;
  }

  await setState(from, "choose_day", draft);
  await sendList(c, from, {
    header: doctor.name,
    body: "Pick a day:",
    button: "Choose day",
    rows: dates.map((d) => ({ id: d, title: dayLabel(d, tz) })),
  });
}

async function offerSlots(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  draft: Draft
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: draft.doctorId! },
    include: { workingHours: true },
  });
  if (!doctor || !draft.date) return startBooking(clinic, from, c, tz, {});

  const dayStart = new Date(`${draft.date}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600_000);
  const busy = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: "booked",
      startAt: { gte: new Date(dayStart.getTime() - 12 * 3600_000), lt: dayEnd },
    },
    select: { startAt: true, endAt: true },
  });
  const holidays = await closedDates(clinic.id, doctor.id, tz);

  const slots = generateSlots({
    timezone: tz,
    slotMinutes: doctor.slotMinutes,
    bufferMinutes: doctor.bufferMinutes,
    workingHours: doctor.workingHours,
    date: draft.date,
    busy,
    holidays,
    minLeadMinutes: 60,
  });

  if (slots.length === 0) {
    await setState(from, "choose_day", draft);
    await sendText(c, from, "That day is full. Send *hi* to pick another day.");
    return;
  }

  await setState(from, "choose_slot", draft);
  await sendList(c, from, {
    header: `${doctor.name} · ${dayLabel(draft.date, tz)}`,
    body: "Available times:",
    button: "Choose time",
    rows: slots.slice(0, 10).map((s) => ({
      id: `${s.startAt.toISOString()}|${s.endAt.toISOString()}`,
      title: s.label,
    })),
  });
}

async function askConfirm(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  draft: Draft
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({ where: { id: draft.doctorId! } });
  const when = formatInTimeZone(new Date(draft.startAt!), tz, "EEE, d MMM · h:mm a");
  await setState(from, "confirm", draft);
  await sendButtons(c, from, {
    body: `Please confirm:\n\n👤 ${draft.patientName}\n🩺 ${doctor?.name} (${doctor?.specialty})\n📅 ${when}\n🏥 ${clinic.name}`,
    buttons: [
      { id: "confirm_yes", title: "Confirm" },
      { id: "confirm_no", title: "Cancel" },
    ],
  });
}

async function finalizeBooking(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  draft: Draft,
  contactName?: string
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({ where: { id: draft.doctorId! } });
  if (!doctor || !draft.startAt || !draft.endAt) {
    await sendText(c, from, "Something went wrong. Send *hi* to start again.");
    return setState(from, "done", {});
  }

  const startAt = new Date(draft.startAt);
  const endAt = new Date(draft.endAt);

  // Guard against a race — someone may have taken the slot mid-flow.
  const clash = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      status: "booked",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (clash) {
    await setState(from, "choose_day", draft);
    await sendText(c, from, "Sorry, that time was just taken. Send *hi* to pick another.");
    return;
  }

  const name = draft.patientName ?? contactName ?? null;
  const patient =
    (draft.patientId
      ? await prisma.patient.findFirst({ where: { id: draft.patientId, clinicId: clinic.id, waPhone: from } })
      : null) ??
    (name
      ? await prisma.patient.findFirst({ where: { clinicId: clinic.id, waPhone: from, name: { equals: name, mode: "insensitive" } } })
      : null) ??
    (await prisma.patient.create({ data: { clinicId: clinic.id, waPhone: from, name, relation: null } }));
  await ensureUhid(patient);

  if (draft.rescheduleOf) {
    await prisma.appointment.updateMany({
      where: { id: draft.rescheduleOf, clinicId: clinic.id },
      data: { status: "cancelled" },
    });
  }

  const appt = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startAt,
      endAt,
      source: "whatsapp",
    },
  });

  const offsets = clinic.reminderOffsets
    .split(",")
    .map((x: string) => parseInt(x.trim(), 10))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  await reminderRows(appt.id, startAt, offsets);

  await setState(from, "done", {});

  const when = formatInTimeZone(startAt, tz, "EEE, d MMM · h:mm a");
  let confirmText = `✅ Booked!\n\n🩺 ${doctor.name} (${doctor.specialty})\n📅 ${when}\n🏥 ${clinic.name}`;
  if (clinic.addressText) confirmText += `\n📍 ${clinic.addressText}`;
  if (clinic.mapsUrl) confirmText += `\n${clinic.mapsUrl}`;
  if (clinic.prepInstructions) confirmText += `\n\nℹ️ ${clinic.prepInstructions}`;
  confirmText += `\n\nReply *reschedule* or *cancel* anytime.`;
  await sendText(c, from, confirmText);
}

/** Upcoming bookings for everyone on this number; asks which one when there are several. */
async function pickAppointment(
  clinic: any,
  from: string,
  c: WaCredentials,
  tz: string,
  action: "cancel" | "reschedule",
  chosenId?: string
) {
  const upcoming = await prisma.appointment.findMany({
    where: { clinicId: clinic.id, patient: { waPhone: from }, status: "booked", startAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
    include: { doctor: true, patient: true },
    take: 9,
  });
  if (chosenId) return upcoming.find((a) => a.id === chosenId) ?? null;
  if (upcoming.length === 0) {
    await sendText(
      c,
      from,
      action === "cancel" ? "You have no upcoming appointments to cancel." : "You have no upcoming appointment to reschedule. Send *hi* to book one."
    );
    return null;
  }
  if (upcoming.length === 1) return upcoming[0];
  await setState(from, action === "cancel" ? "choose_cancel" : "choose_reschedule", {});
  await sendList(c, from, {
    header: action === "cancel" ? "Cancel which appointment?" : "Reschedule which appointment?",
    body: "Your family's upcoming appointments:",
    button: "Choose",
    rows: upcoming.map((a) => ({
      id: a.id,
      title: (a.patient.name ?? "Patient").slice(0, 24),
      description: `${a.doctor.name} · ${formatInTimeZone(a.startAt, tz, "EEE d MMM, h:mm a")}`.slice(0, 72),
    })),
  });
  return null;
}

async function doCancel(clinic: any, from: string, c: WaCredentials, tz: string, chosenId?: string): Promise<void> {
  const next = await pickAppointment(clinic, from, c, tz, "cancel", chosenId);
  if (!next) return;
  await prisma.appointment.update({ where: { id: next.id }, data: { status: "cancelled" } });
  await prisma.reminder.deleteMany({ where: { appointmentId: next.id, sentAt: null } });
  await setState(from, "done", {});
  const when = formatInTimeZone(next.startAt, tz, "EEE, d MMM · h:mm a");
  await sendText(c, from, `Cancelled ${next.patient.name ? `${next.patient.name}'s` : "your"} appointment with ${next.doctor.name} on ${when}.\nSend *hi* to book a new one.`);
}

async function startReschedule(clinic: any, from: string, c: WaCredentials, tz: string, chosenId?: string): Promise<void> {
  const next = await pickAppointment(clinic, from, c, tz, "reschedule", chosenId);
  if (!next) return;
  const draft: Draft = {
    doctorId: next.doctorId,
    rescheduleOf: next.id,
    patientId: next.patientId,
    patientName: next.patient.name ?? undefined,
  };
  await offerDays(clinic, from, c, tz, draft);
}

// ─── utils ─────────────────────────────────────────────────────────────────

function safeParse(s: string): Draft {
  try {
    return JSON.parse(s) as Draft;
  } catch {
    return {};
  }
}


export { minToHHMM };
