// Patient-facing WhatsApp messages from portal actions. Never throws: a
// message failure must not undo the booking/visit it describes. Returns what
// happened so the UI can tell staff ("sent" vs "WhatsApp not connected").
import { envCredentials, sendDocument, sendText, type WaCredentials } from "@/lib/whatsapp";

type ClinicCreds = { whatsappPhoneNumberId: string | null; whatsappToken: string | null };

export function credsFor(clinic: ClinicCreds): WaCredentials {
  if (clinic.whatsappPhoneNumberId && clinic.whatsappToken) {
    return { phoneNumberId: clinic.whatsappPhoneNumberId, token: clinic.whatsappToken };
  }
  return envCredentials();
}

export type NotifyResult = "sent" | "not_configured" | "failed";

export async function notifyText(clinic: ClinicCreds, to: string, text: string): Promise<NotifyResult> {
  try {
    const res = await sendText(credsFor(clinic), to, text);
    return (res as { skipped?: boolean })?.skipped ? "not_configured" : "sent";
  } catch (e) {
    console.error("[notify] text failed", e);
    return "failed";
  }
}

export async function notifyDocument(
  clinic: ClinicCreds,
  to: string,
  doc: { link: string; filename: string; caption: string }
): Promise<NotifyResult> {
  try {
    const res = await sendDocument(credsFor(clinic), to, doc);
    return (res as { skipped?: boolean })?.skipped ? "not_configured" : "sent";
  } catch (e) {
    console.error("[notify] document failed", e);
    return "failed";
  }
}

export function notifyMessage(r: NotifyResult, what = "WhatsApp message") {
  return r === "sent" ? `${what} sent` : r === "not_configured" ? "WhatsApp isn't connected yet — message not sent" : `${what} could not be sent`;
}
