import { describe, expect, it } from "vitest";
import { parseReminderMessage } from "./reminderParser";

const now = new Date("2026-08-01T10:00:00-05:00");

describe("parseReminderMessage compatibility", () => {
  it("interpreta mañana con hora en America/Bogota", () => {
    const result = parseReminderMessage(
      "Recuérdame pagar la luz mañana a las 8 am",
      now
    );
    const hour = result.dueAt
      ? new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          hourCycle: "h23",
          timeZone: "America/Bogota"
        }).format(result.dueAt)
      : "";
    expect(result.ok).toBe(true);
    expect(result.title).toBe("pagar la luz");
    expect(hour).toBe("08");
  });

  it("interpreta un intervalo", () => {
    const result = parseReminderMessage(
      "Recuérdame llamar a Milena en 20 minutos",
      now
    );
    expect(result.ok).toBe(true);
    expect(result.dueAt?.getTime()).toBe(now.getTime() + 20 * 60 * 1000);
  });

  it("pide una hora cuando falta", () => {
    const result = parseReminderMessage(
      "Recuérdame pagar internet mañana",
      now
    );
    expect(result.ok).toBe(false);
    expect(result.clarification).toContain("hora");
  });
});
