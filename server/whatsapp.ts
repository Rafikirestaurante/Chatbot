import { ApiError } from "./firebase.ts";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";

function config() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token || !phoneNumberId || !verifyToken) throw new ApiError(503, "whatsapp_configuration", "WhatsApp aún no está configurado en el servidor.");
  return { token, phoneNumberId, verifyToken };
}

export function verifyWebhook(query: Record<string, unknown>) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) throw new ApiError(503, "whatsapp_configuration", "WhatsApp aún no está configurado en el servidor.");
  if (query["hub.mode"] !== "subscribe" || query["hub.verify_token"] !== verifyToken) throw new ApiError(403, "whatsapp_verification_failed", "Verificación de WhatsApp rechazada.");
  const challenge = query["hub.challenge"];
  if (typeof challenge !== "string" || challenge.length > 200) throw new ApiError(400, "invalid_challenge", "Desafío de WhatsApp inválido.");
  return challenge;
}

export function parseIncoming(body: unknown) {
  if (!body || typeof body !== "object") return [];
  const value = body as any;
  if (value.object !== "whatsapp_business_account") return [];
  const output: Array<{ from: string; messageId: string; text: string }> = [];
  for (const entry of value.entry || []) for (const change of entry.changes || []) {
    for (const message of change.value?.messages || []) {
      const text = message.type === "text" ? String(message.text?.body || "").trim() : "";
      if (typeof message.from === "string" && typeof message.id === "string" && text.length <= 600) output.push({ from: message.from, messageId: message.id, text });
    }
  }
  return output;
}

export async function sendText(to: string, text: string) {
  const { token, phoneNumberId } = config();
  if (!/^\d{7,15}$/.test(to)) throw new ApiError(400, "invalid_recipient", "Destinatario WhatsApp inválido.");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } })
  });
  if (!response.ok) throw new ApiError(502, "whatsapp_upstream_error", "WhatsApp no aceptó el mensaje.");
}
