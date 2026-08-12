import { processAgentMessage } from "../agent/core";
import { createEmptyDialogueState, DEFAULT_AGENT_PREFERENCES } from "../agent/defaults";
import type { ParsedReminder } from "../types";

/**
 * Compatibilidad con Fase 2A. El flujo principal usa Rafiki Agent Core.
 */
export function parseReminderMessage(
  input: string,
  now = new Date(),
  timezone = "America/Bogota"
): ParsedReminder {
  const decision = processAgentMessage({
    input,
    now,
    timezone,
    reminders: [],
    preferences: DEFAULT_AGENT_PREFERENCES,
    state: createEmptyDialogueState(now)
  });

  if (decision.action.type === "create_reminder") {
    return {
      ok: true,
      title: decision.action.title,
      dueAt: new Date(decision.action.dueAt),
      recurrence: decision.action.recurrence,
      confidence: decision.confidence
    };
  }

  return {
    ok: false,
    clarification: decision.reply,
    confidence: decision.confidence
  };
}

export function formatReminderConfirmation(
  date: Date,
  timezone = "America/Bogota"
): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone
  }).format(date);
}
