import { processAgentMessage } from "./core";
import { composeReminderList } from "./responseComposer";
import { getZonedDayRange } from "./dateTime";
import type {
  AgentContext,
  AgentDecision,
  AgentIntent,
  ReminderListFilter
} from "./types";
import type { Recurrence, Reminder } from "../types";

interface GeminiStructuredDecision {
  intent: AgentIntent;
  confidence: number;
  reply: string;
  title?: string;
  dueAtIso?: string;
  recurrenceType?: "none" | "daily" | "weekdays" | "weekly";
  filter?: ReminderListFilter;
  targetReminderId?: string;
  postponeMinutes?: number;
  needsClarification?: boolean;
  missingFields?: Array<"title" | "date" | "time">;
}

function shouldInvokeGeminiFallback(localDecision: AgentDecision, context: AgentContext): boolean {
  if (context.preferences.useGeminiFallback === false) {
    return false;
  }
  // Si el motor local no entendió la intención o tiene baja confianza, delegamos a Gemini
  if (localDecision.intent === "unknown") {
    return true;
  }
  if (localDecision.confidence < 0.78) {
    return true;
  }
  return false;
}

function filterReminders(
  reminders: Reminder[],
  filter: ReminderListFilter,
  now: Date,
  timezone: string
): Reminder[] {
  const today = getZonedDayRange(now, timezone);
  const tomorrow = getZonedDayRange(now, timezone, 1);
  const week = getZonedDayRange(now, timezone, 0, 7);

  return reminders
    .filter((reminder) => {
      const due = new Date(reminder.nextTriggerAt);
      if (filter === "all") return true;
      if (reminder.status !== "pending") return false;
      if (filter === "today") return due >= today.start && due < today.end;
      if (filter === "tomorrow") return due >= tomorrow.start && due < tomorrow.end;
      if (filter === "week") return due >= week.start && due < week.end;
      return true;
    })
    .sort((a, b) => new Date(a.nextTriggerAt).getTime() - new Date(b.nextTriggerAt).getTime());
}

async function fetchGeminiDecision(
  context: AgentContext
): Promise<GeminiStructuredDecision | null> {
  const pendingReminders = context.reminders
    .filter((r) => r.status === "pending")
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      title: r.title,
      nextTriggerAt: r.nextTriggerAt,
      recurrenceType: r.recurrence?.type || "none"
    }));

  const payload = {
    input: context.input,
    nowIso: context.now.toISOString(),
    timezone: context.timezone,
    displayName: context.displayName,
    preferences: context.preferences,
    pendingState: context.state.pending,
    reminders: pendingReminders
  };

  // 1. Intentar primero el endpoint Serverless /api/gemini (Vercel)
  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.ok && data?.decision) {
        return data.decision as GeminiStructuredDecision;
      }
    }
  } catch {
    // Continúa al respaldo local si /api/gemini no está activo en vite dev puro
  }

  // 2. Respaldo opcional para pruebas locales en Vite (solo si se define VITE_GEMINI_API_KEY en .env.local)
  const localDevKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!localDevKey) {
    return null;
  }

  try {
    const model = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(localDevKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Eres Rafiki, asistente de recordatorios en español. Fecha actual: ${payload.nowIso} (${payload.timezone}). Devuelve JSON con {intent, confidence, reply, title?, dueAtIso?, recurrenceType?, filter?, targetReminderId?, postponeMinutes?, needsClarification?, missingFields?}. Datos: ${JSON.stringify(
                  payload
                )}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 350,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    return JSON.parse(raw) as GeminiStructuredDecision;
  } catch {
    return null;
  }
}

function mapGeminiToAgentDecision(
  gemini: GeminiStructuredDecision,
  context: AgentContext,
  fallbackDecision: AgentDecision
): AgentDecision {
  const nowIso = context.now.toISOString();
  const baseState = {
    ...context.state,
    updatedAt: nowIso
  };

  if (gemini.intent === "create_reminder") {
    if (gemini.needsClarification || !gemini.title || !gemini.dueAtIso) {
      const missing: Array<"title" | "date" | "time"> =
        gemini.missingFields && gemini.missingFields.length
          ? gemini.missingFields
          : !gemini.title
          ? ["title", "date", "time"]
          : ["date", "time"];
      return {
        intent: "create_reminder",
        confidence: gemini.confidence || 0.82,
        action: { type: "none" },
        reply: gemini.reply || "¿Para qué día y a qué hora quieres programarlo?",
        nextState: {
          ...baseState,
          pending: {
            kind: "create_reminder",
            originalInput: gemini.title ? `Recuérdame ${gemini.title}` : context.input,
            missing,
            createdAt: nowIso
          }
        },
        source: "gemini"
      };
    }

    const parsedDate = new Date(gemini.dueAtIso);
    if (Number.isNaN(parsedDate.getTime())) {
      return fallbackDecision;
    }

    const recurrence: Recurrence = {
      type: gemini.recurrenceType || "none",
      ...(gemini.recurrenceType === "weekly" ? { weekday: parsedDate.getDay() } : {})
    };

    return {
      intent: "create_reminder",
      confidence: gemini.confidence || 0.92,
      action: {
        type: "create_reminder",
        title: gemini.title.trim(),
        dueAt: parsedDate.toISOString(),
        recurrence
      },
      reply: gemini.reply,
      nextState: { ...baseState, pending: null },
      source: "gemini"
    };
  }

  if (gemini.intent === "list_reminders") {
    const filter: ReminderListFilter = gemini.filter || "pending";
    const matches = filterReminders(context.reminders, filter, context.now, context.timezone);
    return {
      intent: "list_reminders",
      confidence: gemini.confidence || 0.9,
      action: { type: "list_reminders", filter },
      reply: composeReminderList(matches, filter, context.timezone, context.preferences),
      nextState: { ...baseState, pending: null },
      source: "gemini"
    };
  }

  if (
    ["complete_reminder", "cancel_reminder", "postpone_reminder", "update_reminder"].includes(
      gemini.intent
    )
  ) {
    const target = context.reminders.find(
      (item) => item.id === gemini.targetReminderId && item.status === "pending"
    );
    if (!target) {
      return {
        intent: gemini.intent,
        confidence: gemini.confidence || 0.75,
        action: { type: "none" },
        reply: gemini.reply || fallbackDecision.reply,
        nextState: baseState,
        source: "gemini"
      };
    }

    if (gemini.intent === "complete_reminder" || gemini.intent === "cancel_reminder") {
      const status = gemini.intent === "complete_reminder" ? "completed" : "cancelled";
      return {
        intent: gemini.intent,
        confidence: gemini.confidence || 0.9,
        action: {
          type: "set_status",
          reminderId: target.id,
          reminderTitle: target.title,
          status
        },
        reply: gemini.reply,
        nextState: { ...baseState, pending: null, lastReferencedReminderId: target.id },
        referencedReminder: target,
        source: "gemini"
      };
    }

    if (gemini.intent === "postpone_reminder") {
      const minutes = Math.max(1, Number(gemini.postponeMinutes || 10));
      const nextTriggerAt = new Date(context.now.getTime() + minutes * 60_000).toISOString();
      return {
        intent: "postpone_reminder",
        confidence: gemini.confidence || 0.9,
        action: {
          type: "postpone_reminder",
          reminderId: target.id,
          reminderTitle: target.title,
          minutes,
          nextTriggerAt
        },
        reply: gemini.reply,
        nextState: { ...baseState, pending: null, lastReferencedReminderId: target.id },
        referencedReminder: target,
        source: "gemini"
      };
    }

    if (gemini.intent === "update_reminder" && gemini.dueAtIso) {
      const parsedDue = new Date(gemini.dueAtIso);
      if (!Number.isNaN(parsedDue.getTime())) {
        return {
          intent: "update_reminder",
          confidence: gemini.confidence || 0.9,
          action: {
            type: "update_reminder",
            reminderId: target.id,
            reminderTitle: target.title,
            title: (gemini.title || target.title).trim(),
            dueAt: parsedDue.toISOString()
          },
          reply: gemini.reply,
          nextState: { ...baseState, pending: null, lastReferencedReminderId: target.id },
          referencedReminder: target,
          source: "gemini"
        };
      }
    }
  }

  return {
    intent: gemini.intent || "greeting",
    confidence: gemini.confidence || 0.85,
    action: { type: "none" },
    reply: gemini.reply || fallbackDecision.reply,
    nextState: baseState,
    source: "gemini"
  };
}

/**
 * Motor híbrido principal:
 * 1) Ejecuta primero Rafiki Agent Core localmente (0 ms, $0 USD, sin gastar cuota).
 * 2) Si la instrucción no se reconoce o tiene baja confianza, consulta a Gemini API (Free Tier) como respaldo.
 */
export async function processHybridAgentMessage(
  context: AgentContext
): Promise<AgentDecision> {
  const localDecision: AgentDecision = {
    ...processAgentMessage(context),
    source: "local"
  };

  if (!shouldInvokeGeminiFallback(localDecision, context)) {
    return localDecision;
  }

  const geminiResult = await fetchGeminiDecision(context);
  if (!geminiResult) {
    return localDecision;
  }

  return mapGeminiToAgentDecision(geminiResult, context, localDecision);
}
