import { CalendarHeart, CalendarOff, Hospital, IndianRupee, MessageCircle, Settings, Trash2 } from "@/components/icons";
import { toggleService } from "@/app/actions/billing";
import { setMonthlyTarget } from "@/app/actions/finance";
import { rupeeInput } from "@/lib/money";
import { ServiceForm } from "@/components/service-form";
import { rupees } from "@/lib/money";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
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
  const user = await requirePermission("settings.manage");
  const clinic = (await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    include: { holidays: { orderBy: { date: "asc" } }, services: { orderBy: [{ active: "desc" }, { name: "asc" }] } },
  }))!;

  const sharedNumber = process.env.SHARED_WHATSAPP_NUMBER || "";
  const deepLink = sharedNumber
    ? `https://wa.me/${sharedNumber}?text=${encodeURIComponent(clinic.code)}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader icon={Settings} title="Settings" description="Hospital details, booking link, and WhatsApp" />

      <Card>
        <CardHeader>
          <CardTitle icon={CalendarHeart}>Your booking link</CardTitle>
          <CardDescription>
            Share with patients, or open it yourself during a demo. It launches WhatsApp with your
            hospital code <code className="rounded bg-slate-100 px-1 py-0.5">{clinic.code}</code> pre-filled.
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
          <CardTitle icon={Hospital}>Hospital details</CardTitle>
          <CardDescription>Address and prep notes are sent to the patient right after booking, and printed on prescriptions.</CardDescription>
        </CardHeader>
        <CardBody>
          <form action={updateClinic} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hospital name">
              <Input name="name" defaultValue={clinic.name} required />
            </Field>
            <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata">
              <Input name="timezone" defaultValue={clinic.timezone} required />
            </Field>
            <Field label="Reception phone" hint="Printed on receipts and reminder messages">
              <Input name="phone" defaultValue={clinic.phone ?? ""} inputMode="tel" placeholder="020 4000 1234" />
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
          <CardTitle icon={IndianRupee}>Monthly collection target</CardTitle>
          <CardDescription>Shown as a progress ring with a month-end projection on the Finance page.</CardDescription>
        </CardHeader>
        <CardBody>
          <form action={setMonthlyTarget} className="flex flex-wrap items-end gap-2">
            <Field label="Target (₹ per month)" className="w-56">
              <Input name="monthlyTarget" inputMode="decimal" defaultValue={clinic.monthlyTarget ? rupeeInput(clinic.monthlyTarget) : ""} placeholder="1500000" className="tabular" />
            </Field>
            <Button variant="secondary">Save target</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={IndianRupee}>Service price list</CardTitle>
          <CardDescription>One-tap charges on bills — dressing, injection, ECG, certificates. Consultation fees are set per doctor.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <ServiceForm />
          {clinic.services.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {clinic.services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className={s.active ? "text-slate-800" : "text-slate-400 line-through"}>{s.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular font-medium">{rupees(s.price)}</span>
                    <form action={toggleService}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button variant="ghost" size="sm">
                        {s.active ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={CalendarOff}>Closed days</CardTitle>
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
          <CardTitle icon={MessageCircle}>Connect your own WhatsApp number</CardTitle>
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
            <Field
              label="Access token"
              hint={clinic.whatsappToken ? `A token ending …${clinic.whatsappToken.slice(-4)} is saved. Leave blank to keep it.` : "Stored server-side; never shown again."}
            >
              <Input name="token" type="password" autoComplete="off" placeholder={clinic.whatsappToken ? "•••••••• (unchanged)" : "EAAG…"} />
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
