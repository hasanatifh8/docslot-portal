"use server";

import { redirect } from "next/navigation";
import {
  checkPlatformCredentials,
  createPlatformSession,
  destroyPlatformSession,
  platformAdminEnabled,
} from "@/lib/platform-auth";

export type PlatformLoginState = { error?: string };

export async function platformLoginAction(_prev: PlatformLoginState, formData: FormData): Promise<PlatformLoginState> {
  if (!platformAdminEnabled()) return { error: "Admin login is not configured on this server." };
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkPlatformCredentials(username, password)) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Wrong username or password." };
  }
  await createPlatformSession();
  redirect("/admin");
}

export async function platformLogoutAction() {
  await destroyPlatformSession();
  redirect("/admin/login");
}
