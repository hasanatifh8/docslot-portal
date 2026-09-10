/**
 * Seed a demo clinic so you can test the WhatsApp flow immediately.
 *   npx tsx prisma/seed.ts
 * Login:  demo@docslot.test  /  demo1234
 * Clinic code (first WhatsApp message):  sunrise
 */
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function main() {
  const code = "sunrise";
  await prisma.clinic.deleteMany({ where: { code } });

  const clinic = await prisma.clinic.create({
    data: {
      name: "Sunrise Dental Clinic",
      code,
      timezone: "Asia/Kolkata",
      addressText: "2nd Floor, MG Road, Pune",
      mapsUrl: "https://maps.google.com/?q=MG+Road+Pune",
      prepInstructions: "Please arrive 10 minutes early. Bring any prior X-rays.",
      reminderOffsets: "1440,120",
    },
  });

  await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: "demo@docslot.test",
      name: "Dr. Mehra",
      passwordHash: await hashPassword("demo1234"),
    },
  });

  const mehra = await prisma.doctor.create({
    data: { clinicId: clinic.id, name: "Dr. Mehra", specialty: "Dentist", slotMinutes: 20 },
  });
  const sharma = await prisma.doctor.create({
    data: { clinicId: clinic.id, name: "Dr. Sharma", specialty: "Orthodontist", slotMinutes: 30 },
  });

  // Mon–Sat 10:00–13:00 and 17:00–20:00 for both
  const windows: { doctorId: string; weekday: number; startMin: number; endMin: number }[] = [];
  for (const doctorId of [mehra.id, sharma.id]) {
    for (let wd = 1; wd <= 6; wd++) {
      windows.push({ doctorId, weekday: wd, startMin: 600, endMin: 780 });
      windows.push({ doctorId, weekday: wd, startMin: 1020, endMin: 1200 });
    }
  }
  await prisma.workingHour.createMany({ data: windows });

  console.log("Seeded clinic 'Sunrise Dental Clinic'");
  console.log("  Portal login : demo@docslot.test / demo1234");
  console.log("  WhatsApp code : sunrise");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
