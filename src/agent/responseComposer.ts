import type { Reminder } from "../types";
import { formatDateTime } from "./dateTime";
import { hashText } from "./language";
import type { AgentPreferences, ReminderListFilter } from "./types";

function pick(input: string, variants: string[]): string {
  return variants[hashText(input) % variants.length];
}

function emoji(preferences: AgentPreferences, value: string): string {
  return preferences.useEmoji ? value : "";
}

function applyLength(preferences: AgentPreferences, short: string, balanced: string): string {
  return preferences.responseLength === "short" ? short : balanced;
}

export function composeGreeting(
  seed: string,
  preferences: AgentPreferences,
  displayName?: string
): string {
  const name = displayName?.trim().split(/\s+/)[0];
  const suffix = name ? `, ${name}` : "";
  const variantsByTone: Record<AgentPreferences["tone"], string[]> = {
    warm: [
      `¡Hola${suffix}! ${emoji(preferences, "😊 ")}¿Qué quieres que te recuerde?`,
      `¡Hola${suffix}! Estoy listo para ayudarte con tus recordatorios.`,
      `Qué gusto saludarte${suffix}. Dime qué no quieres que se te pase.`
    ],
    professional: [
      `Hola${suffix}. ¿Qué recordatorio deseas programar?`,
      `Hola${suffix}. Estoy disponible para organizar tus recordatorios.`
    ],
    direct: [
      `Hola${suffix}. ¿Qué programamos?`,
      `Listo${suffix}. Escribe tu recordatorio.`
    ],
    motivating: [
      `¡Hola${suffix}! ${emoji(preferences, "🙌 ")}Organicemos lo importante. ¿Qué programamos?`,
      `¡Vamos${suffix}! Dime qué quieres recordar y lo dejamos listo.`
    ]
  };
  return pick(seed, variantsByTone[preferences.tone]);
}

export function composeHelp(preferences: AgentPreferences): string {
  const lead = preferences.tone === "direct"
    ? "Puedo hacer esto:"
    : "Puedo ayudarte a crear y gestionar tus recordatorios:";
  return [
    lead,
    "• “Recuérdame pagar la luz mañana a las 8”.",
    "• “¿Qué tengo pendiente para mañana?”.",
    "• “Pospón el último recordatorio 20 minutos”.",
    "• “Marca como completado el pago del internet”.",
    "• “Cambia la cita del médico para el viernes a las 3”."
  ].join("\n");
}

export function composeCreated(
  seed: string,
  title: string,
  dueAt: Date,
  timezone: string,
  preferences: AgentPreferences
): string {
  const when = formatDateTime(dueAt, timezone);
  const check = emoji(preferences, "✅ ");
  const variantsByTone: Record<AgentPreferences["tone"], string[]> = {
    warm: [
      `${check}Listo, te recordaré ${title.toLowerCase()} el ${when}.`,
      `${check}Perfecto. Quedó programado: ${title}, ${when}.`,
      `${check}Ya quedó. Te avisaré para ${title.toLowerCase()} el ${when}.`
    ],
    professional: [
      `${check}El recordatorio “${title}” quedó programado para el ${when}.`,
      `${check}Recordatorio programado: ${title}. Fecha: ${when}.`
    ],
    direct: [
      `${check}Programado: ${title} — ${when}.`,
      `${check}${title}: ${when}.`
    ],
    motivating: [
      `${check}¡Hecho! Te ayudaré a mantener al día “${title}”. Te aviso el ${when}.`,
      `${check}¡Listo! Un pendiente menos por recordar: ${title}, ${when}.`
    ]
  };
  return pick(seed, variantsByTone[preferences.tone]);
}

export function composeClarification(
  missing: Array<"title" | "date" | "time">,
  preferences: AgentPreferences
): string {
  if (missing.includes("title")) return "¿Qué quieres que te recuerde?";
  if (missing.includes("date") && missing.includes("time")) {
    return applyLength(
      preferences,
      "¿Para qué día y hora?",
      "Entendido. ¿Para qué día y a qué hora quieres que te avise?"
    );
  }
  if (missing.includes("date")) return "¿Para qué día quieres programarlo?";
  return applyLength(
    preferences,
    "¿A qué hora?",
    "Claro. ¿A qué hora quieres que te lo recuerde?"
  );
}


export function composeAmbiguousTime(hour: number): string {
  return `¿Te refieres a las ${hour}:00 de la mañana o de la tarde?`;
}

export function composePastTime(preferences: AgentPreferences): string {
  return applyLength(
    preferences,
    "Esa hora ya pasó. Indícame otra.",
    "Esa fecha u hora ya pasó. Dime una nueva hora o una fecha futura."
  );
}

export function composeDialogueCancelled(preferences: AgentPreferences): string {
  return preferences.tone === "direct"
    ? "Entendido. Cancelé esta solicitud."
    : `${emoji(preferences, "👌 ")}Entendido, dejamos esa solicitud sin programar.`;
}

export function composeUnknown(preferences: AgentPreferences): string {
  return applyLength(
    preferences,
    "No lo entendí. Prueba: “Recuérdame pagar la luz mañana a las 8”.",
    "No estoy seguro de qué acción quieres realizar. Puedes decir, por ejemplo: “Recuérdame pagar la luz mañana a las 8” o “¿Qué tengo pendiente?”."
  );
}

export function composeNoReminderFound(preferences: AgentPreferences): string {
  return applyLength(
    preferences,
    "No identifiqué cuál recordatorio.",
    "No pude identificar a cuál recordatorio te refieres. Escribe una parte del nombre, por ejemplo: “Cancela el recordatorio del internet”."
  );
}

export function composeNoPending(preferences: AgentPreferences): string {
  return preferences.tone === "motivating"
    ? `${emoji(preferences, "🎉 ")}No tienes recordatorios pendientes.`
    : "No tienes recordatorios pendientes.";
}

export function composeStatusChanged(
  seed: string,
  title: string,
  status: "completed" | "cancelled",
  preferences: AgentPreferences
): string {
  if (status === "completed") {
    const variants = [
      `${emoji(preferences, "✅ ")}Marqué “${title}” como completado.`,
      `${emoji(preferences, "🙌 ")}Perfecto, “${title}” quedó completado.`,
      `Listo. “${title}” ya aparece como completado.`
    ];
    return pick(seed, preferences.tone === "direct" ? [variants[0]] : variants);
  }
  const variants = [
    `${emoji(preferences, "🗑️ ")}Cancelé el recordatorio “${title}”.`,
    `Listo, “${title}” ya no está pendiente.`,
    `Entendido. El recordatorio “${title}” quedó cancelado.`
  ];
  return pick(seed, preferences.tone === "direct" ? [variants[0]] : variants);
}

export function composePostponed(
  title: string,
  minutes: number,
  nextTriggerAt: Date,
  timezone: string,
  preferences: AgentPreferences
): string {
  const when = formatDateTime(nextTriggerAt, timezone);
  return applyLength(
    preferences,
    `Pospuesto ${minutes} min: ${title}.`,
    `${emoji(preferences, "⏰ ")}Pospuse “${title}” ${minutes} minutos. Te avisaré el ${when}.`
  );
}

export function composeUpdated(
  title: string,
  dueAt: Date,
  timezone: string,
  preferences: AgentPreferences
): string {
  const when = formatDateTime(dueAt, timezone);
  return applyLength(
    preferences,
    `Actualizado: ${title} — ${when}.`,
    `${emoji(preferences, "✏️ ")}Actualicé “${title}”. La nueva fecha es ${when}.`
  );
}

function filterLabel(filter: ReminderListFilter): string {
  if (filter === "today") return "para hoy";
  if (filter === "tomorrow") return "para mañana";
  if (filter === "week") return "para esta semana";
  if (filter === "all") return "registrados";
  return "pendientes";
}

export function composeReminderList(
  reminders: Reminder[],
  filter: ReminderListFilter,
  timezone: string,
  preferences: AgentPreferences
): string {
  if (!reminders.length) {
    return `No tienes recordatorios ${filterLabel(filter)}.`;
  }

  const visible = reminders.slice(0, 8);
  const lines = visible.map((reminder, index) => {
    const when = formatDateTime(new Date(reminder.nextTriggerAt), timezone);
    return `${index + 1}. ${reminder.title} — ${when}`;
  });
  const extra = reminders.length > visible.length
    ? `\n…y ${reminders.length - visible.length} más.`
    : "";
  const heading = preferences.responseLength === "short"
    ? `Tienes ${reminders.length} ${filterLabel(filter)}:`
    : `Estos son tus recordatorios ${filterLabel(filter)} (${reminders.length}):`;
  return `${heading}\n${lines.join("\n")}${extra}`;
}
