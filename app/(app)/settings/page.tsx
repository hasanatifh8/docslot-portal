import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import {
  updateClinic,
  connectOwnNumber,
  addHoliday,
  deleteHoliday,
} from "@/app/actions/config";

export default async function SettingsPage() {
  const user = await requireUser();
  const clinic = (await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    include: { holidays: { orderBy: { date: "asc" } } },
  }))!;

  const sharedNumber = process.env.SHARED_WHATSAPP_NUMBER || "";
  const deepLink = sharedNumber
    ? `https://wa.me/${sharedNumber}?text=${encodeURIComponent(clinic.code)}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Demo link */}
      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-medium">Your booking link</h2>
        <p className="mt-1 text-sm text-slate-500">
          Share this with patients (or a prospect during a demo). It opens WhatsApp with your
          clinic code <code className="rounded bg-slate-100 px-1">{clinic.code}</code> pre-filled.
        </p>
        {deepLink ? (
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm break-all">{deepLink}</div>
        ) : (
          <p className="mt-3 text-sm text-amber-700">
            Set <code>SHARED_WHATSAPP_NUMBER</code> in the environment to generate the link.
          </p>
        )}
      </section>

      {/* Clinic details */}
      <form action={updateClinic} className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-medium">Clinic details</h2>
        <Field label="Clinic name" name="name" defaultValue={clinic.name} />
        <Field label="Timezone (IANA)" name="timezone" defaultValue={clinic.timezone} />
        <Field label="Address (sent after booking)" name="addressText" defaultValue={clinic.addressText ?? ""} />
        <Field label="Google Maps URL" name="mapsUrl" defaultValue={clinic.mapsUrl ?? ""} />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Prep instructions (sent after booking)</span>
          <textarea
            name="prepInstructions"
            defaultValue={clinic.prepInstructions ?? ""}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <Field
          label="Reminder offsets — minutes before appointment, comma-separated"
          name="reminderOffsets"
          defaultValue={clinic.reminderOffsets}
        />
        <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Save
        </button>
      </form>

      {/* Holidays */}
      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-medium">Closed days</h2>
        <form action={addHoliday} className="mt-3 flex gap-2">
          <input type="date" name="date" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input name="reason" placeholder="Reason (optional)" className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Add</button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {clinic.holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between">
              <span>
                {fmt(h.date, "UTC", "d MMM yyyy")}
                {h.reason ? ` — ${h.reason}` : ""}
              </span>
              <form action={deleteHoliday}>
                <input type="hidden" name="id" value={h.id} />
                <button className="text-xs text-red-600 hover:underline">remove</button>
              </form>
            </li>
          ))}
          {clinic.holidays.length === 0 && <li className="text-slate-500">None</li>}
        </ul>
      </section>

      {/* Own WhatsApp number */}
      <form action={connectOwnNumber} className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-medium">Connect your own WhatsApp number</h2>
        <p className="text-sm text-slate-500">
          Optional. Leave blank to keep using the shared demo number. Once you have your own
          WhatsApp Business number on the Cloud API, paste its phone number ID and a permanent
          access token here.
        </p>
        <Field label="Phone number ID" name="phoneNumberId" defaultValue={clinic.whatsappPhoneNumberId ?? ""} />
        <Field label="Access token" name="token" defaultValue={clinic.whatsappToken ?? ""} />
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Save</button>
      </form>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input {...props} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
  );
}
