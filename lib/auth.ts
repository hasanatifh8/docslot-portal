import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE = "docslot_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + MAX_AGE * 1000) },
  });
  const store = await cookies();
  store.set(COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
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
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Use in server components / actions that require auth. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
