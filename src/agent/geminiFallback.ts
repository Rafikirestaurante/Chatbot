import { processAgentMessage } from "./core";
import { composeReminderList } from "./responseComposer";
import { getZonedDayRange, getWeekdayInTimezone } from "./dateTime";
import { auth, demoMode } from "../config/firebase";
import { parseGeminiDecision, validateAgentDecision } from "./validation";
import type { GeminiStructuredDecision } from "./validation";
import { composeCreated, composeUpdated, composePostponed, composeStatusChanged, composeDialogueCancelled } from "./responseComposer";
import type {
  AgentContext,
  AgentDecision,
  ReminderListFilter
} from "./types";
import type { Recurrence, Reminder } from "../types";

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

export function isGeminiEnabled(preferences: AgentContext["preferences"]): boolean {
  return preferences.useGemini ?? preferences.useGeminiFallback ?? true;
}

async function fetchGeminiDecision(context: AgentContext): Promise<GeminiStructuredDecision | null> {
  if (!auth?.currentUser) throw new Error("Inicia sesión para utilizar Gemini.");
  const token = await auth.currentUser.getIdToken();
  let response: Response;
  try {
    response = await fetch("/api/gemini", {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: 'Bearer ' + token },
      body: JSON.stringify({ input: context.input })
    });
  } catch { return null; }
  // Only provider outages permit local fallback; access and quota errors never do.
  if (!response.ok) {
    let reason = "";
    try { reason = (await response.json()).reason || ""; } catch { /* no raw server errors */ }
    if (response.status === 502 || response.status === 504 || (response.status === 503 && reason === "missing_api_key")) return null;
    const message = response.status === 401 ? "Tu sesión no es válida. Inicia sesión de nuevo."
      : response.status === 403 ? "Tu cuenta o configuración no permite usar Gemini."
      : response.status === 429 ? "Alcanzaste el límite de consultas. Intenta más tarde."
      : response.status === 422 ? "No pude validar la respuesta. Aclara la actividad, fecha o recordatorio."
      : response.status >= 500 ? "El servidor de Rafiki no pudo procesar el mensaje. Intenta más tarde; si continúa, hay que revisar el servicio."
      : "No fue posible validar la solicitud. Intenta de nuevo.";
    throw new Error(message);
  }
  const data = await response.json();
  if (!data?.ok) throw new Error("Respuesta del servidor inválida.");
  return parseGeminiDecision(data.decision, new Date(), context.reminders.filter((r) => r.status === "pending").map((r) => r.id));
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

  if (gemini.confidence < 0.78) return { ...fallbackDecision, intent: gemini.intent, source: "gemini", reply: "¿Puedes aclarar la actividad, fecha o recordatorio que quieres gestionar?" };
  if (gemini.intent === "cancel_dialogue") return { ...fallbackDecision, intent: gemini.intent, source: "gemini", reply: composeDialogueCancelled(context.preferences), nextState: { ...baseState, pending: null } };
  if (gemini.intent === "create_reminder") {
    if (gemini.needsClarification || gemini.missingFields?.length || !gemini.title || !gemini.dueAtIso) {
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
            originalInput: [context.state.pending?.originalInput, context.input].filter(Boolean).join(" ").slice(0, 2000),
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
      ...(gemini.recurrenceType === "weekly" ? { weekday: getWeekdayInTimezone(parsedDate, context.timezone) } : {})
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
      reply: composeCreated(context.input, gemini.title.trim(), parsedDate, context.timezone, context.preferences),
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
        reply: "¿Cuál de tus recordatorios pendientes quieres gestionar?",
        nextState: baseState,
        source: "gemini"
      };
    }

    if (gemini.needsClarification || gemini.missingFields?.length) {
      return { intent: gemini.intent, confidence: gemini.confidence, action: { type: "none" }, reply: gemini.reply, source: "gemini", nextState: { ...baseState, lastReferencedReminderId: target.id, pending: gemini.intent === "update_reminder" ? { kind: "update_reminder", originalInput: context.input, reminderId: target.id, reminderTitle: target.title, missing: ["date", "time"], createdAt: nowIso } : baseState.pending } };
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
        reply: composeStatusChanged(context.input, target.title, status, context.preferences),
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
        reply: composePostponed(target.title, minutes, new Date(nextTriggerAt), context.timezone, context.preferences),
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
          reply: composeUpdated((gemini.title || target.title).trim(), parsedDue, context.timezone, context.preferences),
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

/** Gemini interprets first. Local Core is an explicit offline/outage fallback. */
export async function processHybridAgentMessage(context: AgentContext): Promise<AgentDecision> {
  if (demoMode || !isGeminiEnabled(context.preferences)) {
    return validateAgentDecision({ ...processAgentMessage(context), source: "local" }, context);
  }
  const gemini = await fetchGeminiDecision(context);
  if (!gemini) {
    const local = validateAgentDecision({ ...processAgentMessage(context), source: "local" }, context);
    return { ...local, reply: "Gemini no está disponible; usé el modo local. " + local.reply };
  }
  const noAction: AgentDecision = { intent: "unknown", confidence: 0, action: { type: "none" }, reply: "¿Puedes aclarar tu solicitud?", nextState: context.state, source: "gemini" };
  return validateAgentDecision(mapGeminiToAgentDecision(gemini, context, noAction), context);
}
