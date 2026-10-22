// Signed, unguessable public links for documents sent to patients on
// WhatsApp (prescription PDF). The patient has no login, so the link itself
// is the credential: HMAC over the document id, keyed by LINK_SECRET.
import { createHmac, timingSafeEqual } from "node:crypto";

function key() {
  // LINK_SECRET is preferred; DATABASE_URL is a stable server-only fallback so
  // links work without extra setup.
  return `docslot-link:${process.env.LINK_SECRET || process.env.DATABASE_URL || "dev"}`;
}

export function signId(kind: string, id: string) {
  return createHmac("sha256", key()).update(`${kind}:${id}`).digest("base64url").slice(0, 32);
}

export function verifyId(kind: string, id: string, sig: string | null) {
  if (!sig) return false;
  const a = Buffer.from(signId(kind, id));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function prescriptionLink(visitId: string) {
  return `${appUrl()}/rx/${visitId}?s=${signId("rx", visitId)}`;
}
