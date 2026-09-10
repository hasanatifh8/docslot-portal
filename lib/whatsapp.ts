// Thin wrapper over the WhatsApp Cloud API (Graph API).
// During the shared-demo-number phase every clinic sends through the same
// phone number id + token from env. Once a clinic is on its own number,
// pass its stored credentials instead.

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";

export type WaCredentials = { phoneNumberId: string; token: string };

export function envCredentials(): WaCredentials {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const token = process.env.WHATSAPP_TOKEN || "";
  return { phoneNumberId, token };
}

async function post(creds: WaCredentials, body: unknown) {
  if (!creds.phoneNumberId || !creds.token) {
    console.warn("[whatsapp] missing credentials — message not sent:", JSON.stringify(body));
    return { skipped: true };
  }
  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[whatsapp] send failed", res.status, JSON.stringify(json));
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
  return json;
}

/** Plain text reply (only valid inside the 24h customer-service window). */
export function sendText(creds: WaCredentials, to: string, text: string) {
  return post(creds, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

/**
 * Interactive list — best UX for choosing a doctor or a slot.
 * `rows` max 10 per section; `title` max 24 chars; `description` max 72.
 */
export function sendList(
  creds: WaCredentials,
  to: string,
  opts: {
    body: string;
    button: string;
    header?: string;
    footer?: string;
    rows: { id: string; title: string; description?: string }[];
  }
) {
  return post(creds, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(opts.header ? { header: { type: "text", text: opts.header } } : {}),
      body: { text: opts.body },
      ...(opts.footer ? { footer: { text: opts.footer } } : {}),
      action: {
        button: opts.button,
        sections: [{ title: opts.button, rows: opts.rows.slice(0, 10) }],
      },
    },
  });
}

/** Interactive reply buttons — max 3. */
export function sendButtons(
  creds: WaCredentials,
  to: string,
  opts: { body: string; buttons: { id: string; title: string }[] }
) {
  return post(creds, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: opts.body },
      action: {
        buttons: opts.buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Template message — REQUIRED to open a conversation outside the 24h window
 * (i.e. every reminder). The template must be pre-approved in Meta with a
 * matching name + language + parameter count.
 */
export function sendTemplate(
  creds: WaCredentials,
  to: string,
  name: string,
  language: string,
  bodyParams: string[]
) {
  return post(creds, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      components: bodyParams.length
        ? [
            {
              type: "body",
              parameters: bodyParams.map((t) => ({ type: "text", text: t })),
            },
          ]
        : [],
    },
  });
}

// ─── Inbound payload parsing ───────────────────────────────────────────────

export type InboundMessage = {
  phoneNumberId: string;
  from: string; // patient E.164 digits
  contactName?: string;
  /** normalised text — plain text body OR the id of a tapped list row / button */
  text: string;
  /** the visible title of a tapped list row / button, if any */
  choiceTitle?: string;
  raw: unknown;
};

/** Pull the first user message out of a webhook POST body. Returns null for
 *  status callbacks and anything we don't handle. */
export function parseInbound(body: any): InboundMessage | null {
  try {
    const change = body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null;

    const phoneNumberId = value?.metadata?.phone_number_id ?? "";
    const from = msg.from as string;
    const contactName = value?.contacts?.[0]?.profile?.name as string | undefined;

    let text = "";
    let choiceTitle: string | undefined;

    if (msg.type === "text") {
      text = msg.text?.body ?? "";
    } else if (msg.type === "interactive") {
      const i = msg.interactive;
      if (i?.type === "list_reply") {
        text = i.list_reply?.id ?? "";
        choiceTitle = i.list_reply?.title;
      } else if (i?.type === "button_reply") {
        text = i.button_reply?.id ?? "";
        choiceTitle = i.button_reply?.title;
      }
    } else if (msg.type === "button") {
      text = msg.button?.payload ?? msg.button?.text ?? "";
    }

    return { phoneNumberId, from, contactName, text: text.trim(), choiceTitle, raw: msg };
  } catch {
    return null;
  }
}
