import type { Reminder } from "../types";
import { normalizeText, tokenize } from "./language";

const STOP_WORDS = new Set([
  "recordatorio", "recordatorios", "ultimo", "ultima", "ese", "esa", "esto",
  "cancela", "cancelar", "completa", "completado", "marca", "como", "hecho",
  "pospone", "aplaza", "cambia", "mueve", "reprograma", "para", "las", "los",
  "del", "que", "quiero", "por", "favor", "mañana", "manana", "hoy"
]);

export function findReminderByReference(
  input: string,
  reminders: Reminder[],
  lastReferencedReminderId?: string
): Reminder | null {
  const pending = reminders.filter((item) => item.status === "pending");
  if (!pending.length) return null;

  const text = normalizeText(input);
  if (/\b(ese|esa|el ultimo|la ultima|ultimo recordatorio|cancelalo|completalo|posponlo|muevelo)\b/.test(text)) {
    if (lastReferencedReminderId) {
      const referenced = pending.find((item) => item.id === lastReferencedReminderId);
      if (referenced) return referenced;
    }
    return [...pending].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }

  const queryTokens = tokenize(input).filter((token) => !STOP_WORDS.has(token));
  if (!queryTokens.length) return pending.length === 1 ? pending[0] : null;

  const ranked = pending
    .map((reminder) => {
      const titleTokens = new Set(tokenize(reminder.title));
      const matches = queryTokens.filter((token) => titleTokens.has(token)).length;
      const partial = queryTokens.filter((token) =>
        [...titleTokens].some((titleToken) => titleToken.includes(token) || token.includes(titleToken))
      ).length;
      return { reminder, score: matches * 2 + partial };
    })
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.score > 0) return ranked[0].reminder;
  return pending.length === 1 ? pending[0] : null;
}
