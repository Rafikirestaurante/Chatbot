// Endpoint Serverless para Vercel (/api/gemini)
// Mantiene GEMINI_API_KEY segura en el servidor usando el nivel gratuito de Google AI Studio.

interface GeminiRequestPayload {
  input: string;
  nowIso: string;
  timezone: string;
  displayName?: string;
  preferences: {
    tone: "warm" | "professional" | "direct" | "motivating";
    responseLength: "short" | "balanced";
    useEmoji: boolean;
    morningHour: number;
    afternoonHour: number;
    eveningHour: number;
  };
  pendingState?: unknown;
  reminders?: Array<{
    id: string;
    title: string;
    nextTriggerAt: string;
    recurrenceType: string;
  }>;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "STRING",
      enum: [
        "create_reminder",
        "list_reminders",
        "complete_reminder",
        "cancel_reminder",
        "postpone_reminder",
        "update_reminder",
        "greeting",
        "help",
        "cancel_dialogue",
        "unknown"
      ]
    },
    confidence: { type: "NUMBER" },
    reply: { type: "STRING" },
    title: { type: "STRING" },
    dueAtIso: { type: "STRING" },
    recurrenceType: {
      type: "STRING",
      enum: ["none", "daily", "weekdays", "weekly"]
    },
    filter: {
      type: "STRING",
      enum: ["pending", "today", "tomorrow", "week", "all"]
    },
    targetReminderId: { type: "STRING" },
    postponeMinutes: { type: "NUMBER" },
    needsClarification: { type: "BOOLEAN" },
    missingFields: {
      type: "ARRAY",
      items: {
        type: "STRING",
        enum: ["title", "date", "time"]
      }
    }
  },
  required: ["intent", "confidence", "reply"]
};

function buildSystemInstruction(payload: GeminiRequestPayload): string {
  const toneMap: Record<string, string> = {
    warm: "cercano, amable y cálido",
    professional: "profesional, claro y ejecutivo",
    direct: "directo, breve y al grano",
    motivating: "motivador, positivo y energético"
  };
  const lengthDesc =
    payload.preferences?.responseLength === "short"
      ? "muy concisa (máximo 1 oración corta)"
      : "natural y equilibrada (1 a 2 oraciones)";
  const emojiDesc = payload.preferences?.useEmoji
    ? "Puedes usar 1 emoji discreto cuando aporte calidez."
    : "NO uses ningún emoji.";

  return [
    "Eres Rafiki, un asistente privado en español especializado en gestionar recordatorios personales y responder con naturalidad.",
    `Fecha y hora actual (ISO): ${payload.nowIso}. Zona horaria del usuario: ${payload.timezone || "America/Bogota"}.`,
    `Nombre del usuario: ${payload.displayName || "Usuario"}.`,
    `Tono requerido: ${toneMap[payload.preferences?.tone] || "cercano"}. Extensión: ${lengthDesc}. ${emojiDesc}`,
    `Horas predeterminadas del usuario: mañana=${payload.preferences?.morningHour ?? 9}:00, después del almuerzo/tarde=${payload.preferences?.afternoonHour ?? 14}:00, noche=${payload.preferences?.eveningHour ?? 20}:00.`,
    "Reglas de decisión:",
    "1. Si el usuario pide recordar, agendar, avisar o anotar algo y tienes actividad + fecha/hora futura clara, usa intent='create_reminder', completa 'title', 'dueAtIso' (en formato ISO-8601 exacto considerando la zona horaria del usuario) y 'recurrenceType' ('none', 'daily', 'weekdays' o 'weekly').",
    "2. Si el usuario quiere crear o actualizar un recordatorio pero falta la fecha, la hora o la actividad, usa intent='create_reminder' (o 'update_reminder'), pon needsClarification=true, indica qué falta en 'missingFields' (['time'], ['date', 'time'], etc.), guarda el título parcial en 'title' y redacta la pregunta aclaratoria en 'reply'.",
    "3. Si pide ver o consultar sus pendientes, usa intent='list_reminders' y define 'filter' ('pending', 'today', 'tomorrow', 'week' o 'all').",
    "4. Si pide completar, cancelar, posponer o reprogramar un recordatorio existente de la lista proporcionada, selecciona su 'id' exacto en 'targetReminderId'. Para posponer indica 'postponeMinutes' (por defecto 10). Para actualizar indica 'dueAtIso' y 'title'.",
    "5. Si hace una pregunta general, saluda o conversa sin pedir cambios sobre recordatorios, responde amablemente en 'reply' manteniendo tu rol de asistente Rafiki y usa intent='greeting' o 'help'."
  ].join("\n");
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Usa POST." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      ok: false,
      reason: "missing_api_key",
      message: "GEMINI_API_KEY no está configurada en las variables de entorno del servidor."
    });
    return;
  }

  try {
    const payload: GeminiRequestPayload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    if (!payload.input || typeof payload.input !== "string") {
      res.status(400).json({ ok: false, error: "El campo 'input' es obligatorio." });
      return;
    }

    const preferredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const candidateModels = Array.from(
      new Set([preferredModel, "gemini-3.5-flash-lite", "gemini-2.5-flash"])
    );

    const userPrompt = JSON.stringify(
      {
        mensajeUsuario: payload.input.slice(0, 600),
        estadoPendienteActual: payload.pendingState || null,
        recordatoriosPendientes: (payload.reminders || []).slice(0, 15)
      },
      null,
      2
    );

    let lastError = "No fue posible conectar con Gemini.";
    for (const model of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemInstruction(payload) }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 350,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
          }
        })
      });

      if (!response.ok) {
        await response.text().catch(() => "");
        lastError = `El proveedor devolvió HTTP ${response.status}.`;
        if (response.status === 404 || response.status === 400) {
          continue;
        }
        break;
      }

      const data: any = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!rawText) {
        lastError = "Respuesta vacía del modelo Gemini.";
        break;
      }

      const parsed = JSON.parse(rawText);
      res.status(200).json({
        ok: true,
        model,
        decision: parsed
      });
      return;
    }

    res.status(502).json({
      ok: false,
      reason: "upstream_error",
      message: lastError
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      reason: "exception",
      message: "Error interno en /api/gemini"
    });
  }
}
