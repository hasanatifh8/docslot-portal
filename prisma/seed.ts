/**
 * Seed a demo hospital so you can try every role immediately.
 *   npm run db:seed
 * Logins (password demo1234 for all):
 *   demo@docslot.test        administrator
 *   reception@docslot.test   receptionist
 *   nurse@docslot.test       nurse
 *   jr.rao@docslot.test      junior doctor (triage)
 *   dr.mehra@docslot.test    senior doctor (Dr. Mehra)
 * Hospital code (first WhatsApp message):  sunrise
 */
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { formatUhid } from "../lib/patients";
import { formatInvoiceNo } from "../lib/billing";
import { dayRange } from "../lib/format";

async function main() {
  const code = "sunrise";
  await prisma.clinic.deleteMany({ where: { code } });
  // Users are unique by email across tenants — clear demo logins too.
  await prisma.user.deleteMany({ where: { email: { endsWith: "@docslot.test" } } });

  const clinic = await prisma.clinic.create({
    data: {
      name: "Sunrise Multispeciality Hospital",
      code,
      timezone: "Asia/Kolkata",
      addressText: "MG Road, Pune 411001",
      mapsUrl: "https://maps.google.com/?q=MG+Road+Pune",
      prepInstructions: "Please arrive 15 minutes early and bring previous prescriptions and reports.",
      reminderOffsets: "1440,120",
    },
  });

  const [general, ortho, paeds] = await Promise.all(
    ["General Medicine", "Orthopaedics", "Paediatrics"].map((name) =>
      prisma.department.create({ data: { clinicId: clinic.id, name } })
    )
  );

  const mehra = await prisma.doctor.create({
    data: {
      clinicId: clinic.id,
      name: "Dr. Mehra",
      specialty: "Physician",
      qualification: "MBBS, MD (Medicine)",
      registrationNo: "MMC 2011/04/1234",
      departmentId: general.id,
      slotMinutes: 15,
      room: "3",
      consultFee: 50000,
      followUpFee: 0,
      followUpDays: 7,
    },
  });
  const sharma = await prisma.doctor.create({
    data: {
      clinicId: clinic.id,
      name: "Dr. Sharma",
      specialty: "Orthopaedic Surgeon",
      qualification: "MBBS, MS (Ortho)",
      departmentId: ortho.id,
      slotMinutes: 20,
      room: "7",
      consultFee: 70000,
      followUpFee: 30000,
      followUpDays: 14,
    },
  });
  const iyer = await prisma.doctor.create({
    data: {
      clinicId: clinic.id,
      name: "Dr. Iyer",
      specialty: "Paediatrician",
      qualification: "MBBS, DCH",
      departmentId: paeds.id,
      slotMinutes: 15,
      room: "5",
      consultFee: 40000,
      followUpFee: 0,
      followUpDays: 5,
    },
  });

  // Mon–Sat 10:00–18:00 for all
  const windows: { doctorId: string; weekday: number; startMin: number; endMin: number }[] = [];
  for (const doctorId of [mehra.id, sharma.id, iyer.id]) {
    for (let wd = 1; wd <= 6; wd++) {
      windows.push({ doctorId, weekday: wd, startMin: 600, endMin: 1080 });
    }
  }
  await prisma.workingHour.createMany({ data: windows });

  const passwordHash = await hashPassword("demo1234");
  await prisma.user.createMany({
    data: [
      { clinicId: clinic.id, email: "demo@docslot.test", name: "Hospital Admin", role: "admin", passwordHash },
      { clinicId: clinic.id, email: "reception@docslot.test", name: "Ritu Kapoor", role: "receptionist", passwordHash },
      { clinicId: clinic.id, email: "nurse@docslot.test", name: "Anita Desai", role: "nurse", passwordHash },
      { clinicId: clinic.id, email: "jr.rao@docslot.test", name: "Dr. Kiran Rao", role: "junior_doctor", passwordHash },
      {
        clinicId: clinic.id,
        email: "dr.mehra@docslot.test",
        name: "Dr. Mehra",
        role: "doctor",
        doctorId: mehra.id,
        passwordHash,
      },
    ],
  });

  const patientRows = [
    { name: "Rahul Verma", waPhone: "919812345678", gender: "male", dob: "1988-03-14", bloodGroup: "B+", relation: "self" },
    { name: "Priya Verma", waPhone: "919812345678", gender: "female", dob: "1990-08-02", bloodGroup: "O+", relation: "spouse" },
    { name: "Anaya Verma", waPhone: "919812345678", gender: "female", dob: "2018-05-11", bloodGroup: "B+", relation: "child" },
    {
      name: "Sunita Patil",
      waPhone: "919823456789",
      gender: "female",
      dob: "1962-11-02",
      bloodGroup: "O+",
      relation: "self",
      allergies: "Penicillin",
      chronicConditions: "Type 2 diabetes, Hypertension",
    },
    { name: "Aarav Joshi", waPhone: "919834567890", gender: "male", dob: "2019-07-21", bloodGroup: "A+", relation: "child" },
    { name: "Imran Shaikh", waPhone: "919845678901", gender: "male", dob: "1975-01-30", bloodGroup: "AB+", relation: "self", chronicConditions: "Asthma" },
  ];
  const patients = [];
  for (const [i, p] of patientRows.entries()) {
    patients.push(
      await prisma.patient.create({
        data: { ...p, clinicId: clinic.id, uhid: formatUhid(i + 1), dob: new Date(`${p.dob}T00:00:00Z`) },
      })
    );
  }
  const [rahul, priya, anaya, sunita, aarav, imran] = patients;

  await prisma.serviceItem.createMany({
    data: [
      ["Dressing (small)", 15000],
      ["Injection (IM/IV)", 10000],
      ["ECG", 30000],
      ["Nebulization", 20000],
      ["Medical certificate", 20000],
      ["Blood sugar (glucometer)", 5000],
    ].map(([name, price]) => ({ clinicId: clinic.id, name: name as string, price: price as number })),
  });

  const users = await prisma.user.findMany({ where: { clinicId: clinic.id } });
  const reception = users.find((u) => u.role === "receptionist")!;
  const nurse = users.find((u) => u.role === "nurse")!;
  const drUser = users.find((u) => u.role === "doctor")!;

  await prisma.consultTemplate.createMany({
    data: [
      {
        clinicId: clinic.id,
        doctorId: mehra.id,
        createdById: drUser.id,
        name: "Viral fever (adult)",
        chiefComplaint: "Fever, body ache",
        examination: "Febrile, throat congested, chest clear",
        diagnosis: "Viral infection, unspecified",
        icdCode: "B34.9",
        advice: "Plenty of oral fluids; adequate rest; return if fever beyond 3 days",
        items: [
          { medicine: "Paracetamol 650 mg tab", dosage: "1 tab", frequency: "1-1-1", duration: "3 days", instructions: "After food, if fever" },
          { medicine: "Cetirizine 10 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "5 days", instructions: "At bedtime" },
        ],
      },
      {
        clinicId: clinic.id,
        doctorId: null,
        createdById: drUser.id,
        name: "Acidity / gastritis",
        chiefComplaint: "Acidity, epigastric burning",
        examination: "Epigastric tenderness",
        diagnosis: "Gastritis, unspecified",
        icdCode: "K29.70",
        advice: "Avoid spicy & oily food; small frequent meals",
        items: [
          { medicine: "Pantoprazole 40 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "14 days", instructions: "Before breakfast" },
          { medicine: "Antacid gel", dosage: "10 ml", frequency: "1-1-1", duration: "5 days", instructions: "After food" },
        ],
      },
    ],
  });

  // ── A realistic day: past visits, today's queue, bills and follow-ups ──
  const tz = clinic.timezone;
  const { start: today } = dayRange(tz);
  const at = (dayOffset: number, h: number, m = 0) => new Date(today.getTime() + dayOffset * 86400_000 + (h * 60 + m) * 60_000);
  let inv = 1;
  const bill = async (patientId: string, visitId: string, label: string, fee: number, paidBy: string | null, by: string, when: Date) =>
    prisma.invoice.create({
      data: {
        clinicId: clinic.id,
        number: formatInvoiceNo(inv++),
        patientId,
        visitId,
        createdById: by,
        createdAt: when,
        subtotal: fee,
        total: fee,
        paid: paidBy ? fee : 0,
        status: fee === 0 || paidBy ? "paid" : "unpaid",
        items: { create: [{ description: label, qty: 1, unitPrice: fee, amount: fee }] },
        ...(paidBy && fee ? { payments: { create: [{ amount: fee, mode: paidBy, receivedById: by, createdAt: when }] } } : {}),
      },
    });

  // Sunita: seen 6 days ago by Dr. Mehra, follow-up due today.
  const past = await prisma.visit.create({
    data: {
      clinicId: clinic.id, patientId: sunita.id, doctorId: mehra.id, token: 2, status: "COMPLETED", visitType: "new",
      checkedInAt: at(-6, 10, 5), checkedInById: reception.id, triageById: nurse.id, triageStartedAt: at(-6, 10, 12), triageCompletedAt: at(-6, 10, 18),
      consultById: drUser.id, consultStartedAt: at(-6, 10, 31), completedAt: at(-6, 10, 44),
      bpSystolic: 152, bpDiastolic: 94, pulse: 84, spo2: 97, temperatureC: 36.9, weightKg: 71, heightCm: 158,
      chiefComplaint: "Headache, BP check", diagnosis: "Essential (primary) hypertension", icdCode: "I10",
      advice: "Salt-restricted diet; Monitor BP at home", followUpDate: new Date(`${dayRange(tz).day}T00:00:00Z`),
      prescriptionItems: { create: [
        { medicine: "Telmisartan 40 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", sortOrder: 0 },
        { medicine: "Metformin 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "1 month", instructions: "After food", sortOrder: 1 },
      ] },
    },
  });
  await bill(sunita.id, past.id, `Consultation — ${mehra.name}`, 50000, "upi", reception.id, at(-6, 10, 6));

  // Imran: seen 20 days ago, follow-up overdue.
  const old = await prisma.visit.create({
    data: {
      clinicId: clinic.id, patientId: imran.id, doctorId: mehra.id, token: 5, status: "COMPLETED", visitType: "new",
      checkedInAt: at(-20, 11), consultStartedAt: at(-20, 11, 30), completedAt: at(-20, 11, 42), checkedInById: reception.id, consultById: drUser.id,
      chiefComplaint: "Wheezing at night", diagnosis: "Asthma, uncomplicated", icdCode: "J45.909", followUpDate: new Date(today.getTime() - 6 * 86400_000),
      prescriptionItems: { create: [{ medicine: "Budesonide + Formoterol inhaler 200/6", dosage: "2 puffs", frequency: "1-0-1", duration: "1 month", sortOrder: 0 }] },
    },
  });
  await bill(imran.id, old.id, `Consultation — ${mehra.name}`, 50000, "cash", reception.id, at(-20, 11));

  // Today's queue.
  const q1 = await prisma.visit.create({
    data: {
      clinicId: clinic.id, patientId: rahul.id, doctorId: mehra.id, token: 1, status: "TRIAGE_COMPLETED", visitType: "new",
      checkedInAt: at(0, 9, 40), checkedInById: reception.id, triageById: nurse.id, triageStartedAt: at(0, 9, 48), triageCompletedAt: at(0, 9, 55),
      chiefComplaint: "Fever, Body ache", bpSystolic: 124, bpDiastolic: 82, pulse: 96, spo2: 97, temperatureC: 38.6, heightCm: 176, weightKg: 74,
    },
  });
  await bill(rahul.id, q1.id, `Consultation — ${mehra.name}`, 50000, "cash", reception.id, at(0, 9, 40));
  const q2 = await prisma.visit.create({
    data: {
      clinicId: clinic.id, patientId: anaya.id, doctorId: iyer.id, token: 1, status: "CHECKED_IN", visitType: "new", priority: "priority",
      checkedInAt: at(0, 9, 52), checkedInById: reception.id, chiefComplaint: "Cough, Cold & runny nose",
    },
  });
  await bill(anaya.id, q2.id, `Consultation — ${iyer.name}`, 40000, null, reception.id, at(0, 9, 52));
  const q3 = await prisma.visit.create({
    data: {
      clinicId: clinic.id, patientId: aarav.id, doctorId: iyer.id, token: 2, status: "CHECKED_IN", visitType: "new", priority: "emergency",
      checkedInAt: at(0, 10, 1), checkedInById: reception.id, chiefComplaint: "Breathlessness",
    },
  });
  await bill(aarav.id, q3.id, `Consultation — ${iyer.name}`, 40000, null, reception.id, at(0, 10, 1));

  // Upcoming bookings today.
  for (const [p, d, h, m, note] of [
    [priya, mehra, 16, 0, "Follow-up"],
    [imran, sharma, 16, 40, "New complaint"],
  ] as const) {
    const startAt = at(0, h, m);
    await prisma.appointment.create({
      data: { clinicId: clinic.id, doctorId: d.id, patientId: p.id, startAt, endAt: new Date(startAt.getTime() + d.slotMinutes * 60_000), source: "frontdesk", note },
    });
  }

  await prisma.clinic.update({ where: { id: clinic.id }, data: { nextUhid: patients.length + 1, nextInvoiceNo: inv, phone: "020 4000 1234" } });
  void priya;

  console.log(`Seeded '${clinic.name}'`);
  console.log("  Logins (password demo1234): demo@ / reception@ / nurse@ / jr.rao@ / dr.mehra@ docslot.test");
  console.log("  Demo family on +91 98123 45678: Rahul, Priya, Anaya Verma");
  console.log("  WhatsApp code : sunrise");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
