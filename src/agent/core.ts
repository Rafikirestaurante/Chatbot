import type { Reminder } from "../types";
import { parseSchedule, extractDurationMinutes, getZonedDayRange } from "./dateTime";
import { routeIntent } from "./intentRouter";
import { normalizeText } from "./language";
import { findReminderByReference } from "./reminderReference";
import {
  composeAmbiguousTime,
  composeClarification,
  composeCreated,
  composeDialogueCancelled,
  composeGreeting,
  composeHelp,
  composeNoPending,
  composeNoReminderFound,
  composePastTime,
  composePostponed,
  composeReminderList,
  composeStatusChanged,
  composeUnknown,
  composeUpdated
} from "./responseComposer";
import type {
  AgentContext,
  AgentDecision,
  AgentDialogueState,
  ReminderListFilter
} from "./types";

function nextState(
  current: AgentDialogueState,
  patch: Partial<AgentDialogueState>,
  now: Date
): AgentDialogueState {
  return {
    ...current,
    ...patch,
    updatedAt: now.toISOString()
  };
}

function cleanTitle(input: string): string {
  const command = input.match(/(?:recu[eé]rdame|recordarme|av[ií]same|agenda|programa|anota)\s+(?:que\s+)?(.+)/i);
  const source = command?.[1] || input;
  return source
    .replace(/^(hola\s+)?rafiki[,\s:-]*/i, "")
    .replace(/^(por favor\s+)?(recu[eé]rdame|recordarme|av[ií]same|agenda|programa|anota)\s+(que\s+)?/i, "")
    .replace(/\b(en|dentro de)\s+(media|un cuarto de|\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(minutos?|horas?|d[ií]as?)\b.*$/i, "")
    .replace(/\b(hoy|mañana|pasado mañana)\b.*$/i, "")
    .replace(/\b(?:este |el |pr[oó]ximo )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b.*$/i, "")
    .replace(/\b(?:el\s+)?\d{1,2}(?:[/-]\d{1,2}|\s+de\s+[a-záéíóúñ]+).*$/i, "")
    .replace(/\b(todos los d[ií]as|cada d[ií]a|diariamente|de lunes a viernes|d[ií]as h[aá]biles|entre semana)\b.*$/i, "")
    .replace(/\b(?:todos? los?|cada)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b.*$/i, "")
    .replace(/(?:a\s+las?|a\s+la|las?)\s+(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::\d{2})?.*$/i, "")
    .replace(/\b(por la mañana|en la mañana|por la tarde|en la tarde|por la noche|en la noche|despu[eé]s del almuerzo)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:-]+$/, "")
    .trim();
}

function detectListFilter(input: string): ReminderListFilter {
  const text = normalizeText(input);
  if (/\bmanana\b/.test(text)) return "tomorrow";
  if (/\bhoy\b/.test(text)) return "today";
  if (/\b(esta semana|semana)\b/.test(text)) return "week";
  if (/\b(todos|historial|registrados)\b/.test(text)) return "all";
  return "pending";
}

function remindersForFilter(
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

function mergePendingInput(original: string, followUp: string): string {
  const text = normalizeText(followUp);
  if (/^(si|sí|ok|okay|dale|listo)$/.test(text)) return original;
  return `${original} ${followUp}`.trim();
}

function createDecision(context: AgentContext, sourceInput: string, confidence: number): AgentDecision {
  const title = cleanTitle(sourceInput);
  const schedule = parseSchedule(sourceInput, context.now, context.timezone, context.preferences);
  const missing: Array<"title" | "date" | "time"> = [];
  if (!title) missing.push("title");
  if (!schedule.hasDate) missing.push("date");
  if (!schedule.hasTime) missing.push("time");

  if (schedule.error === "ambiguous_meridiem") {
    return {
      intent: "create_reminder",
      confidence: 0.72,
      action: { type: "none" },
      reply: composeAmbiguousTime(schedule.ambiguousHour || 3),
      nextState: nextState(
        context.state,
        {
          pending: {
            kind: "create_reminder",
            originalInput: sourceInput,
            missing: ["time"],
            createdAt: context.now.toISOString()
          }
        },
        context.now
      )
    };
  }

  if (schedule.error === "past") {
    return {
      intent: "create_reminder",
      confidence: 0.94,
      action: { type: "none" },
      reply: composePastTime(context.preferences),
      nextState: nextState(
        context.state,
        {
          pending: {
            kind: "create_reminder",
            originalInput: `Recuérdame ${title}`,
            missing: ["date", "time"],
            createdAt: context.now.toISOString()
          }
        },
        context.now
      )
    };
  }

  if (missing.length || !schedule.dueAt) {
    return {
      intent: "create_reminder",
      confidence: Math.min(confidence, 0.75),
      action: { type: "none" },
      reply: composeClarification(missing, context.preferences),
      nextState: nextState(
        context.state,
        {
          pending: {
            kind: "create_reminder",
            originalInput: sourceInput,
            missing,
            createdAt: context.now.toISOString()
          }
        },
        context.now
      )
    };
  }

  return {
    intent: "create_reminder",
    confidence,
    action: {
      type: "create_reminder",
      title,
      dueAt: schedule.dueAt.toISOString(),
      recurrence: schedule.recurrence
    },
    reply: composeCreated(
      sourceInput,
      title,
      schedule.dueAt,
      context.timezone,
      context.preferences
    ),
    nextState: nextState(context.state, { pending: null }, context.now)
  };
}


function updateDecision(
  context: AgentContext,
  reminder: Reminder,
  sourceInput: string,
  confidence: number
): AgentDecision {
  const schedule = parseSchedule(
    sourceInput,
    context.now,
    context.timezone,
    context.preferences
  );
  const missing: Array<"date" | "time"> = [];
  if (!schedule.hasDate) missing.push("date");
  if (!schedule.hasTime) missing.push("time");

  const pendingState = nextState(
    context.state,
    {
      pending: {
        kind: "update_reminder",
        originalInput: sourceInput,
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        missing,
        createdAt: context.now.toISOString()
      },
      lastReferencedReminderId: reminder.id
    },
    context.now
  );

  if (schedule.error === "ambiguous_meridiem") {
    return {
      intent: "update_reminder",
      confidence: 0.72,
      action: { type: "none" },
      reply: composeAmbiguousTime(schedule.ambiguousHour || 3),
      nextState: pendingState,
      referencedReminder: reminder
    };
  }

  if (schedule.error === "past") {
    return {
      intent: "update_reminder",
      confidence: 0.8,
      action: { type: "none" },
      reply: composePastTime(context.preferences),
      nextState: pendingState,
      referencedReminder: reminder
    };
  }

  if (!schedule.dueAt) {
    return {
      intent: "update_reminder",
      confidence: Math.min(confidence, 0.7),
      action: { type: "none" },
      reply: composeClarification(missing, context.preferences),
      nextState: pendingState,
      referencedReminder: reminder
    };
  }

  const updatedTitle = parseUpdatedTitle(sourceInput, reminder.title);
  return {
    intent: "update_reminder",
    confidence,
    action: {
      type: "update_reminder",
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      title: updatedTitle,
      dueAt: schedule.dueAt.toISOString()
    },
    reply: composeUpdated(
      updatedTitle,
      schedule.dueAt,
      context.timezone,
      context.preferences
    ),
    nextState: nextState(
      context.state,
      { pending: null, lastReferencedReminderId: reminder.id },
      context.now
    ),
    referencedReminder: reminder
  };
}

function parseUpdatedTitle(input: string, currentTitle: string): string {
  const match = input.match(/\b(?:renombra|cambia el nombre(?: del recordatorio)? a)\s+[“\"]?(.+?)[”\"]?(?:\s+(?:para|el|hoy|mañana|a las)\b|$)/i);
  return match?.[1]?.trim() || currentTitle;
}

export function processAgentMessage(context: AgentContext): AgentDecision {
  const routed = routeIntent(context.input);
  if (routed.intent === "cancel_dialogue" && !context.state.pending) {
    routed.intent = "cancel_reminder";
    routed.confidence = 0.88;
  }

  if (context.state.pending && routed.intent !== "cancel_dialogue") {
    const pending = context.state.pending;
    const combined = mergePendingInput(pending.originalInput, context.input);
    if (pending.kind === "create_reminder") {
      return createDecision(context, combined, 0.91);
    }

    const reminder = context.reminders.find(
      (item) => item.id === pending.reminderId && item.status === "pending"
    );
    if (reminder) {
      return updateDecision(context, reminder, combined, 0.9);
    }
  }

  if (routed.intent === "cancel_dialogue") {
    return {
      intent: "cancel_dialogue",
      confidence: routed.confidence,
      action: { type: "none" },
      reply: composeDialogueCancelled(context.preferences),
      nextState: nextState(context.state, { pending: null }, context.now)
    };
  }

  if (routed.intent === "greeting") {
    return {
      intent: routed.intent,
      confidence: routed.confidence,
      action: { type: "none" },
      reply: composeGreeting(context.input, context.preferences, context.displayName),
      nextState: nextState(context.state, {}, context.now)
    };
  }

  if (routed.intent === "help") {
    return {
      intent: routed.intent,
      confidence: routed.confidence,
      action: { type: "none" },
      reply: composeHelp(context.preferences),
      nextState: nextState(context.state, {}, context.now)
    };
  }

  if (routed.intent === "create_reminder") {
    return createDecision(context, context.input, routed.confidence);
  }

  if (routed.intent === "list_reminders") {
    const filter = detectListFilter(context.input);
    const matches = remindersForFilter(
      context.reminders,
      filter,
      context.now,
      context.timezone
    );
    return {
      intent: routed.intent,
      confidence: routed.confidence,
      action: { type: "list_reminders", filter },
      reply: composeReminderList(matches, filter, context.timezone, context.preferences),
      nextState: nextState(context.state, { pending: null }, context.now)
    };
  }

  if (["complete_reminder", "cancel_reminder", "postpone_reminder", "update_reminder"].includes(routed.intent)) {
    const reminder = findReminderByReference(
      context.input,
      context.reminders,
      context.state.lastReferencedReminderId
    );

    if (!reminder) {
      const hasPending = context.reminders.some((item) => item.status === "pending");
      return {
        intent: routed.intent,
        confidence: 0.55,
        action: { type: "none" },
        reply: hasPending
          ? composeNoReminderFound(context.preferences)
          : composeNoPending(context.preferences),
        nextState: nextState(context.state, { pending: null }, context.now)
      };
    }

    const stateWithReference = nextState(
      context.state,
      { pending: null, lastReferencedReminderId: reminder.id },
      context.now
    );

    if (routed.intent === "complete_reminder" || routed.intent === "cancel_reminder") {
      const status = routed.intent === "complete_reminder" ? "completed" : "cancelled";
      return {
        intent: routed.intent,
        confidence: routed.confidence,
        action: {
          type: "set_status",
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          status
        },
        reply: composeStatusChanged(context.input, reminder.title, status, context.preferences),
        nextState: stateWithReference,
        referencedReminder: reminder
      };
    }

    if (routed.intent === "postpone_reminder") {
      const minutes = extractDurationMinutes(context.input) || 10;
      const nextTriggerAt = new Date(context.now.getTime() + minutes * 60_000);
      return {
        intent: routed.intent,
        confidence: routed.confidence,
        action: {
          type: "postpone_reminder",
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          minutes,
          nextTriggerAt: nextTriggerAt.toISOString()
        },
        reply: composePostponed(
          reminder.title,
          minutes,
          nextTriggerAt,
          context.timezone,
          context.preferences
        ),
        nextState: stateWithReference,
        referencedReminder: reminder
      };
    }

    return updateDecision(context, reminder, context.input, routed.confidence);
  }

  return {
    intent: "unknown",
    confidence: routed.confidence,
    action: { type: "none" },
    reply: composeUnknown(context.preferences),
    nextState: nextState(context.state, {}, context.now)
  };
}
