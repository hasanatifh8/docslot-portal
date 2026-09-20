import { NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

// Hit by a free external scheduler (e.g. cron-job.org) every ~5 min, since
// Vercel's Hobby-plan cron only fires once a day. Auth via a shared secret —
// either `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const fromHeader = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const fromQuery = req.nextUrl.searchParams.get("secret");

  if (fromHeader !== secret && fromQuery !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await sendDueReminders();
  return Response.json(result);
}
