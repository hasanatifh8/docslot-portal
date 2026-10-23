import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { can, type Permission } from "@/lib/rbac";

const COOKIE = "docslot_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

const SUPPORT_MAX_AGE = 60 * 60 * 2; // support sessions end after 2 hours

export async function createSession(userId: string, opts: { impersonatedBy?: string } = {}) {
  const maxAge = opts.impersonatedBy ? SUPPORT_MAX_AGE : MAX_AGE;
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + maxAge * 1000), impersonatedBy: opts.impersonatedBy ?? null },
  });
  const store = await cookies();
  store.set(COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) await prisma.session.deleteMany({ where: { id } });
  store.delete(COOKIE);
}

/** Returns the signed-in user + clinic, or null. */
export async function getCurrentUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { include: { clinic: true } } },
  });
  const support = !!session?.impersonatedBy;
  // Support sessions may open suspended hospitals / inactive accounts to investigate.
  if (!session || session.expiresAt < new Date() || (!support && (!session.user.active || !session.user.clinic.active))) {
    if (session) await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  // In support mode every audit entry and screen shows it wasn't the real user.
  return support
    ? { ...session.user, name: `${session.user.name} (via platform support)`, supportMode: true as boolean, supportUntil: session.expiresAt as Date | null }
    : { ...session.user, supportMode: false as boolean, supportUntil: null as Date | null };
}

/** Use in server components / actions that require auth. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/**
 * Pages: signed-in user holding `perm`, otherwise bounce to the dashboard.
 * Actions: pass `{ throwOnDeny: true }` so a forged request fails loudly.
 */
export async function requirePermission(perm: Permission, opts: { throwOnDeny?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) {
    if (opts.throwOnDeny) throw new Error("UNAUTHENTICATED");
    redirect("/login");
  }
  if (!can(user.role, perm)) {
    if (opts.throwOnDeny) throw new Error("FORBIDDEN");
    redirect("/dashboard");
  }
  return user;
}
