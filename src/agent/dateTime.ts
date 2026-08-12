import type { Recurrence } from "../types";
import type { AgentPreferences } from "./types";
import { normalizeText } from "./language";

const DAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6
};

const MONTH_NAMES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function wallDateFromInstant(date: Date, timezone: string): Date {
  const parts = getZonedParts(date, timezone);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );
}

function wallDateToInstant(wallDate: Date, timezone: string): Date {
  const desiredUtc = Date.UTC(
    wallDate.getUTCFullYear(),
    wallDate.getUTCMonth(),
    wallDate.getUTCDate(),
    wallDate.getUTCHours(),
    wallDate.getUTCMinutes(),
    wallDate.getUTCSeconds()
  );

  let candidate = new Date(desiredUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(candidate, timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const difference = desiredUtc - actualAsUtc;
    if (difference === 0) break;
    candidate = new Date(candidate.getTime() + difference);
  }
  return candidate;
}

function clone(date: Date): Date {
  return new Date(date.getTime());
}

function addMinutes(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 60_000);
}

function addWallDays(date: Date, amount: number): Date {
  const result = clone(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function nextWeekday(date: Date, weekday: number): Date {
  const result = clone(date);
  let distance = (weekday - result.getUTCDay() + 7) % 7;
  if (distance === 0) distance = 7;
  result.setUTCDate(result.getUTCDate() + distance);
  return result;
}

function parseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  return NUMBER_WORDS[value] ?? null;
}

function detectRecurrence(text: string): Recurrence {
  if (/\b(todos los dias|cada dia|diariamente)\b/.test(text)) {
    return { type: "daily" };
  }
  if (/\b(de lunes a viernes|dias habiles|entre semana)\b/.test(text)) {
    return { type: "weekdays" };
  }

  for (const [name, weekday] of Object.entries(DAY_NAMES)) {
    if (new RegExp(`\\b(?:todos? los?|cada) ${name}s?\\b`).test(text)) {
      return { type: "weekly", weekday };
    }
  }

  return { type: "none" };
}

function parseRelative(text: string, now: Date): Date | null {
  if (/\b(en|dentro de)\s+media\s+hora\b/.test(text)) {
    return addMinutes(now, 30);
  }
  if (/\b(en|dentro de)\s+un\s+cuarto\s+de\s+hora\b/.test(text)) {
    return addMinutes(now, 15);
  }

  const match = text.match(
    /\b(?:en|dentro de)\s+(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(minutos?|horas?|dias?)\b/
  );
  if (!match) return null;
  const amount = parseNumber(match[1]);
  if (!amount) return null;
  if (match[2].startsWith("minuto")) return addMinutes(now, amount);
  if (match[2].startsWith("hora")) return addMinutes(now, amount * 60);
  return addMinutes(now, amount * 24 * 60);
}

function parseClock(
  text: string,
  preferences: AgentPreferences
): { hours: number; minutes: number; ambiguousMeridiem?: boolean } | null {
  if (/\bmediodia\b/.test(text)) return { hours: 12, minutes: 0 };
  if (/\bmedianoche\b/.test(text)) return { hours: 0, minutes: 0 };
  if (/\b(despues del almuerzo|despues de almorzar)\b/.test(text)) {
    return { hours: preferences.afternoonHour, minutes: 0 };
  }
  if (/\b(temprano en la manana|por la manana|en la manana)\b/.test(text)) {
    return { hours: preferences.morningHour, minutes: 0 };
  }
  if (/\b(por la tarde|en la tarde)\b/.test(text)) {
    return { hours: preferences.afternoonHour, minutes: 0 };
  }
  if (/\b(por la noche|en la noche)\b/.test(text)) {
    return { hours: preferences.eveningHour, minutes: 0 };
  }

  const clock = text.match(
    /(?:a\s+las?|a\s+la|las?)\s+(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm|de la manana|de la tarde|de la noche)?\b/
  );
  if (!clock) return null;

  const parsedHours = parseNumber(clock[1]);
  if (parsedHours === null || parsedHours > 23) return null;
  let hours = parsedHours;
  const minutes = Number(clock[2] || 0);
  if (minutes > 59) return null;

  const meridiem = (clock[3] || "").replace(/[.\s]/g, "");
  if (["pm", "delatarde", "delanoche"].includes(meridiem)) {
    if (hours < 12) hours += 12;
  } else if (["am", "delamanana"].includes(meridiem) && hours === 12) {
    hours = 0;
  }

  return {
    hours,
    minutes,
    ambiguousMeridiem: !meridiem && hours >= 1 && hours <= 6
  };
}

function parseDate(text: string, wallNow: Date): Date | null {
  if (/\bpasado manana\b/.test(text)) return addWallDays(wallNow, 2);
  if (/\bmanana\b/.test(text)) return addWallDays(wallNow, 1);
  if (/\bhoy\b/.test(text)) return clone(wallNow);

  const numeric = text.match(/\b(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : wallNow.getUTCFullYear();
    if (year < 100) year += 2000;
    let date = new Date(Date.UTC(year, month, day));
    if (!numeric[3] && date.getTime() < wallNow.getTime()) {
      date = new Date(Date.UTC(year + 1, month, day));
    }
    return date.getUTCDate() === day && date.getUTCMonth() === month ? date : null;
  }

  const named = text.match(
    /\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/
  );
  if (named) {
    const day = Number(named[1]);
    const month = MONTH_NAMES[named[2]];
    let year = named[3] ? Number(named[3]) : wallNow.getUTCFullYear();
    let date = new Date(Date.UTC(year, month, day));
    if (!named[3] && date.getTime() < wallNow.getTime()) {
      year += 1;
      date = new Date(Date.UTC(year, month, day));
    }
    return date.getUTCDate() === day && date.getUTCMonth() === month ? date : null;
  }

  for (const [name, weekday] of Object.entries(DAY_NAMES)) {
    if (new RegExp(`\\b(?:este |el |proximo )?${name}\\b`).test(text)) {
      return nextWeekday(wallNow, weekday);
    }
  }

  return null;
}

function setWallClock(
  date: Date,
  clock: { hours: number; minutes: number }
): Date {
  const result = clone(date);
  result.setUTCHours(clock.hours, clock.minutes, 0, 0);
  return result;
}

export interface ScheduleParseResult {
  dueAt: Date | null;
  recurrence: Recurrence;
  hasDate: boolean;
  hasTime: boolean;
  isRelative: boolean;
  error?: "past" | "ambiguous_meridiem";
  ambiguousHour?: number;
}

export function parseSchedule(
  input: string,
  now: Date,
  timezone: string,
  preferences: AgentPreferences
): ScheduleParseResult {
  const text = normalizeText(input);
  const recurrence = detectRecurrence(text);
  const relative = parseRelative(text, now);
  if (relative) {
    return {
      dueAt: relative,
      recurrence,
      hasDate: true,
      hasTime: true,
      isRelative: true
    };
  }

  const wallNow = wallDateFromInstant(now, timezone);
  let wallDate = parseDate(text, wallNow);
  const clock = parseClock(text, preferences);

  if (!wallDate && recurrence.type !== "none") {
    if (recurrence.type === "weekly" && recurrence.weekday !== undefined) {
      wallDate = nextWeekday(wallNow, recurrence.weekday);
    } else {
      wallDate = clone(wallNow);
    }
  }

  if (!wallDate || !clock) {
    return {
      dueAt: null,
      recurrence,
      hasDate: Boolean(wallDate),
      hasTime: Boolean(clock),
      isRelative: false
    };
  }

  if (clock.ambiguousMeridiem) {
    return {
      dueAt: null,
      recurrence,
      hasDate: true,
      hasTime: false,
      isRelative: false,
      error: "ambiguous_meridiem",
      ambiguousHour: clock.hours
    };
  }

  let wallDueAt = setWallClock(wallDate, clock);
  let dueAt = wallDateToInstant(wallDueAt, timezone);

  if (recurrence.type !== "none" && dueAt.getTime() <= now.getTime()) {
    if (recurrence.type === "weekly") {
      wallDueAt = addWallDays(wallDueAt, 7);
    } else {
      do {
        wallDueAt = addWallDays(wallDueAt, 1);
      } while (
        recurrence.type === "weekdays" &&
        (wallDueAt.getUTCDay() === 0 || wallDueAt.getUTCDay() === 6)
      );
    }
    dueAt = wallDateToInstant(wallDueAt, timezone);
  }

  if (recurrence.type === "none" && dueAt.getTime() <= now.getTime()) {
    return {
      dueAt: null,
      recurrence,
      hasDate: true,
      hasTime: true,
      isRelative: false,
      error: "past"
    };
  }

  return {
    dueAt,
    recurrence,
    hasDate: true,
    hasTime: true,
    isRelative: false
  };
}


export function addCalendarDaysInTimezone(
  instant: Date,
  days: number,
  timezone: string
): Date {
  const wallDate = wallDateFromInstant(instant, timezone);
  return wallDateToInstant(addWallDays(wallDate, days), timezone);
}

export function getWeekdayInTimezone(
  instant: Date,
  timezone: string
): number {
  return wallDateFromInstant(instant, timezone).getUTCDay();
}

export function getZonedDayRange(
  instant: Date,
  timezone: string,
  offsetDays = 0,
  durationDays = 1
): { start: Date; end: Date } {
  let wallStart = wallDateFromInstant(instant, timezone);
  wallStart.setUTCHours(0, 0, 0, 0);
  wallStart = addWallDays(wallStart, offsetDays);
  const wallEnd = addWallDays(wallStart, durationDays);
  return {
    start: wallDateToInstant(wallStart, timezone),
    end: wallDateToInstant(wallEnd, timezone)
  };
}

export function extractDurationMinutes(input: string): number | null {
  const text = normalizeText(input);
  if (/\bmedia\s+hora\b/.test(text)) return 30;
  if (/\bun\s+cuarto\s+de\s+hora\b/.test(text)) return 15;

  const match = text.match(
    /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(minutos?|horas?)\b/
  );
  if (!match) return null;
  const amount = parseNumber(match[1]);
  if (!amount) return null;
  return match[2].startsWith("hora") ? amount * 60 : amount;
}

export function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone
  }).format(date);
}

export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone
  }).format(date);
}
