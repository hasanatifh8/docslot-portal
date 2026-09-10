import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import {
  updateClinic,
  connectOwnNumber,
  addHoliday,
  deleteHoliday,
} from "@/app/actions/config";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { CopyField } from "@/components/copy-field";

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
    <div className="space-y-6">
      <PageHeader title="Settings" description="Clinic details, booking link, and WhatsApp" />

      <Card>
        <CardHeader>
          <CardTitle>Your booking link</CardTitle>
          <CardDescription>
            Share with patients, or open it yourself during a demo. It launches WhatsApp with your
            clinic code <code className="rounded bg-slate-100 px-1 py-0.5">{clinic.code}</code> pre-filled.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {deepLink ? (
            <CopyField value={deepLink} />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-inset ring-amber-600/10">
              Set <code>SHARED_WHATSAPP_NUMBER</code> in the environment to generate the link.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinic details</CardTitle>
          <CardDescription>Address and prep notes are sent to the patient right after booking.</CardDescription>
        </CardHeader>
        <CardBody>
          <form action={updateClinic} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Clinic name">
              <Input name="name" defaultValue={clinic.name} required />
            </Field>
            <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata">
              <Input name="timezone" defaultValue={clinic.timezone} required />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input name="addressText" defaultValue={clinic.addressText ?? ""} placeholder="2nd Floor, MG Road, Pune" />
            </Field>
            <Field label="Google Maps URL" className="sm:col-span-2">
              <Input name="mapsUrl" defaultValue={clinic.mapsUrl ?? ""} placeholder="https://maps.google.com/?q=…" />
            </Field>
            <Field label="Prep instructions" className="sm:col-span-2">
              <Textarea
                name="prepInstructions"
                defaultValue={clinic.prepInstructions ?? ""}
                rows={2}
                placeholder="Please arrive 10 minutes early."
              />
            </Field>
            <Field label="Reminder timing" hint="Minutes before the appointment, comma-separated" className="sm:col-span-2">
              <Input name="reminderOffsets" defaultValue={clinic.reminderOffsets} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Closed days</CardTitle>
          <CardDescription>Full-day closures — no slots are offered on these dates.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <form action={addHoliday} className="flex flex-wrap items-end gap-2">
            <Field label="Date">
              <Input type="date" name="date" required className="w-44" />
            </Field>
            <Field label="Reason (optional)" className="flex-1">
              <Input name="reason" placeholder="Diwali" />
            </Field>
            <Button variant="secondary">Add</Button>
          </form>
          {clinic.holidays.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-inset ring-slate-200">
              {clinic.holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-slate-700">
                    {fmt(h.date, "UTC", "d MMM yyyy")}
                    {h.reason && <span className="text-slate-400"> · {h.reason}</span>}
                  </span>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No closed days added.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect your own WhatsApp number</CardTitle>
          <CardDescription>
            Optional. Leave blank to keep using the shared demo number. Once your own WhatsApp
            Business number is live on the Cloud API, paste its phone number ID and a permanent
            access token.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form action={connectOwnNumber} className="space-y-4">
            <Field label="Phone number ID">
              <Input name="phoneNumberId" defaultValue={clinic.whatsappPhoneNumberId ?? ""} placeholder="1234567890" />
            </Field>
            <Field label="Access token">
              <Input name="token" defaultValue={clinic.whatsappToken ?? ""} placeholder="EAAG…" />
            </Field>
            <Button variant="secondary" type="submit">
              Save
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
