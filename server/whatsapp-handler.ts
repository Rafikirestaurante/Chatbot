import { ApiError } from "./firebase.ts";
import { parseIncoming, sendText, verifyWebhook } from "./whatsapp.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).send(verifyWebhook(req.query || {}));
    if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method_not_allowed" });
    const messages = parseIncoming(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    for (const message of messages) await sendText(message.from, "Recibí tu mensaje. Rafiki ya está conectado a WhatsApp; la interpretación de recordatorios se activará en el siguiente paso.");
    return res.status(200).json({ ok: true, received: messages.length });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ ok: false, reason: error.reason, message: error.message });
    return res.status(400).json({ ok: false, reason: "invalid_webhook_request", message: "Solicitud de WhatsApp inválida." });
  }
}
