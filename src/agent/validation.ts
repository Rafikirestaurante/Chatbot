import type { AgentContext, AgentDecision, AgentIntent, ReminderListFilter } from "./types";

export const MAX_POSTPONE_MINUTES = 525600;
const intents = new Set<AgentIntent>(["create_reminder", "list_reminders", "complete_reminder", "cancel_reminder", "postpone_reminder", "update_reminder", "greeting", "help", "cancel_dialogue", "unknown"]);
const recurrenceTypes = new Set(["none", "daily", "weekdays", "weekly"]);
const filters = new Set(["pending", "today", "tomorrow", "week", "all"]);
export interface GeminiStructuredDecision {
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

export function assertTitle(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 300) throw new Error("La actividad debe tener entre 1 y 300 caracteres.");
}

export function assertFutureDate(value: unknown, now = new Date()): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("La fecha debe incluir la zona horaria.");
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(value);
  if (year > 2100 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || !Number.isFinite(date.getTime()) || date <= now) throw new Error("Elige una fecha y hora futuras válidas.");
}

export function assertMinutes(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_POSTPONE_MINUTES) throw new Error("El plazo debe ser de 1 a 525600 minutos.");
}

export function assertDocumentId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value || value.length > 128 || value.includes("/") || value === "." || value === "..") throw new Error("Identificador inválido.");
}

export function parseGeminiDecision(value: unknown, now: Date, pendingIds: string[]): GeminiStructuredDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta de IA inválida.");
  const d = value as GeminiStructuredDecision;
  const allowed = new Set(["intent", "confidence", "reply", "title", "dueAtIso", "recurrenceType", "filter", "targetReminderId", "postponeMinutes", "needsClarification", "missingFields"]);
  if (Object.keys(d).some((key) => !allowed.has(key)) || !intents.has(d.intent) || typeof d.confidence !== "number" || !Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 1 || typeof d.reply !== "string" || !d.reply.trim() || d.reply.length > 2000) throw new Error("Respuesta de IA inválida.");
  if (d.title !== undefined) assertTitle(d.title);
  if (d.recurrenceType !== undefined && !recurrenceTypes.has(d.recurrenceType)) throw new Error("Recurrencia inválida.");
  if (d.filter !== undefined && !filters.has(d.filter)) throw new Error("Filtro inválido.");
  if (d.needsClarification !== undefined && typeof d.needsClarification !== "boolean") throw new Error("Aclaración inválida.");
  if (d.missingFields !== undefined && (!Array.isArray(d.missingFields) || d.missingFields.length > 3 || d.missingFields.some((x) => !["title", "date", "time"].includes(x)))) throw new Error("Campos pendientes inválidos.");
  if (d.postponeMinutes !== undefined) assertMinutes(d.postponeMinutes);
  if (d.targetReminderId !== undefined) {
    assertDocumentId(d.targetReminderId);
    if (!pendingIds.includes(d.targetReminderId)) throw new Error("El recordatorio no pertenece a los pendientes del usuario.");
  }
  if (d.dueAtIso !== undefined) assertFutureDate(d.dueAtIso, now);
  const actionable = d.confidence >= 0.78 && !d.needsClarification && !d.missingFields?.length;
  if (actionable && d.intent === "create_reminder") {
    assertTitle(d.title);
    assertFutureDate(d.dueAtIso, now);
  }
  if (actionable && ["complete_reminder", "cancel_reminder", "postpone_reminder", "update_reminder"].includes(d.intent)) {
    if (!d.targetReminderId) throw new Error("Falta seleccionar un recordatorio propio pendiente.");
    if (d.intent === "update_reminder") assertFutureDate(d.dueAtIso, now);
    if (d.intent === "postpone_reminder") assertMinutes(d.postponeMinutes ?? 10);
  }
  return d;
}

// Last check before persistence, also applied to the local fallback.
export function validateAgentDecision(decision: AgentDecision, context: AgentContext): AgentDecision {
  const a = decision.action;
  if (a.type === "create_reminder" || a.type === "update_reminder") {
    assertTitle(a.title);
    assertFutureDate(a.dueAt, new Date(Math.max(Date.now(), context.now.getTime())));
  }
  if (a.type === "create_reminder" && !recurrenceTypes.has(a.recurrence.type)) throw new Error("Recurrencia inválida.");
  if ("reminderId" in a) {
    assertDocumentId(a.reminderId);
    if (!context.reminders.some((r) => r.id === a.reminderId && r.status === "pending")) throw new Error("El recordatorio ya no está pendiente.");
  }
  if (a.type === "postpone_reminder") assertMinutes(a.minutes);
  return decision;
}
