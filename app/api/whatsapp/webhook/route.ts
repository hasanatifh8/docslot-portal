import { NextRequest } from "next/server";
import { parseInbound } from "@/lib/whatsapp";
import { handleInbound } from "@/lib/conversation";

// Meta calls GET once to verify the webhook, then POSTs every inbound message
// and status update. Must respond 200 fast — do work inline but keep it lean.

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const msg = parseInbound(body);
  if (msg && msg.from) {
    try {
      await handleInbound(msg);
    } catch (err) {
      console.error("[webhook] handleInbound failed", err);
    }
  }

  // Always 200 so Meta doesn't retry-storm us.
  return new Response("ok", { status: 200 });
}
