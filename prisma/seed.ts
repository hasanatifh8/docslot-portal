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

  const patients = [
    { name: "Rahul Verma", waPhone: "919812345678", gender: "male", dob: "1988-03-14", bloodGroup: "B+" },
    {
      name: "Sunita Patil",
      waPhone: "919823456789",
      gender: "female",
      dob: "1962-11-02",
      bloodGroup: "O+",
      allergies: "Penicillin",
      chronicConditions: "Type 2 diabetes, hypertension",
    },
    { name: "Aarav Joshi", waPhone: "919834567890", gender: "male", dob: "2019-07-21", bloodGroup: "A+" },
  ];
  for (const [i, p] of patients.entries()) {
    await prisma.patient.create({
      data: { ...p, clinicId: clinic.id, uhid: formatUhid(i + 1), dob: new Date(`${p.dob}T00:00:00Z`) },
    });
  }
  await prisma.clinic.update({ where: { id: clinic.id }, data: { nextUhid: patients.length + 1 } });

  console.log(`Seeded '${clinic.name}'`);
  console.log("  Logins (password demo1234): demo@ / reception@ / nurse@ / jr.rao@ / dr.mehra@ docslot.test");
  console.log("  WhatsApp code : sunrise");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
