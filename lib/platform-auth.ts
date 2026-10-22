// Platform admin (/admin) — a single login configured by env vars, separate
// from hospital staff accounts:
//   SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD
// The session is a stateless signed cookie. Its signing key is derived from the
// credentials, so changing the password signs every admin session out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "docslot_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function credentials() {
  const username = process.env.SUPER_ADMIN_USERNAME ?? "";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  return username && password ? { username, password } : null;
}

export function platformAdminEnabled() {
  return credentials() !== null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time compare (hashing first makes both sides equal length). */
function safeEqual(a: string, b: string) {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sign(payload: string) {
  const creds = credentials();
  if (!creds) return null;
  const key = sha256(`docslot-admin:${creds.username}:${creds.password}`);
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function checkPlatformCredentials(username: string, password: string) {
  const creds = credentials();
  if (!creds) return false;
  // Evaluate both so timing doesn't reveal which one was wrong.
  const userOk = safeEqual(username, creds.username);
  const passOk = safeEqual(password, creds.password);
  return userOk && passOk;
}

export async function createPlatformSession() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const store = await cookies();
  store.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroyPlatformSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isPlatformAdmin() {
  const store = await cookies();
  const [exp, sig] = (store.get(COOKIE)?.value ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return expected !== null && safeEqual(sig, expected);
}

/**
 * Pages: bounce to /admin/login when not signed in.
 * Actions: pass `{ throwOnDeny: true }` so a forged request fails loudly.
 */
export async function requirePlatformAdmin(opts: { throwOnDeny?: boolean } = {}) {
  if (await isPlatformAdmin()) return;
  if (opts.throwOnDeny) throw new Error("UNAUTHENTICATED");
  redirect("/admin/login");
}
