import type { AgentIntent } from "./types";
import { includesAny, normalizeText } from "./language";

export function routeIntent(input: string): { intent: AgentIntent; confidence: number } {
  const text = normalizeText(input);

  if (!text) return { intent: "unknown", confidence: 0 };

  if (includesAny(text, [
    /^(hola|buenos dias|buenas tardes|buenas noches|hey|holi|que tal)\b/,
    /\bcomo estas\b/
  ])) {
    return { intent: "greeting", confidence: 0.98 };
  }

  if (includesAny(text, [
    /\b(ayuda|que puedes hacer|como funciona|comandos|opciones)\b/,
    /^help$/
  ])) {
    return { intent: "help", confidence: 0.97 };
  }

  if (includesAny(text, [
    /\b(olvida eso|dejalo asi|cancela eso|no importa)\b/
  ])) {
    return { intent: "cancel_dialogue", confidence: 0.9 };
  }

  if (includesAny(text, [
    /\b(que tengo|que hay|muestrame|mostrar|lista|listar|cuales son|ver mis|consultar)\b.*\b(recordatorios|pendientes|para hoy|para manana|esta semana)?\b/,
    /^mis recordatorios$/,
    /^pendientes$/
  ])) {
    return { intent: "list_reminders", confidence: 0.94 };
  }

  if (includesAny(text, [
    /\b(pospon|pospone|aplaza|aplazalo|dejalo para despues|recuerdame de nuevo)\b/,
    /\b(en|por)\s+(\d+|media|una?)\s+(minutos?|horas?)\b.*\b(ultimo|recordatorio|ese|lo)\b/
  ])) {
    return { intent: "postpone_reminder", confidence: 0.95 };
  }

  if (includesAny(text, [
    /\b(complet\w*|termin\w*|hecho|listo ya|ya lo hice|marcalo como hecho)\b/
  ])) {
    return { intent: "complete_reminder", confidence: 0.93 };
  }

  if (includesAny(text, [
    /\b(cancela|cancelar|anula|elimina|borra)\b.*\b(recordatorio|ultimo|ese|lo|de)?\b/,
    /^(cancelalo|eliminalo|borralo)$/
  ])) {
    return { intent: "cancel_reminder", confidence: 0.93 };
  }

  if (includesAny(text, [
    /\b(cambia|mueve|reprograma|modifica|pasa)\b.*\b(recordatorio|para|a las|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/
  ])) {
    return { intent: "update_reminder", confidence: 0.9 };
  }

  if (includesAny(text, [
    /\b(recuerdame|recordarme|avisame|avisa me|agenda|programa|anota)\b/,
    /^en\s+(\d+|media|una?)\s+(minutos?|horas?)\b/
  ])) {
    return { intent: "create_reminder", confidence: 0.96 };
  }

  return { intent: "unknown", confidence: 0.25 };
}
