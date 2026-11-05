import { describe, expect, it } from "vitest";
import { assertFutureDate, assertMinutes, parseGeminiDecision } from "./validation";
import { normalizeAgentPreferences } from "./defaults";
const now = new Date("2026-11-05T15:00:00Z");
describe("validation of untrusted AI output", () => {
  it("bounds stored preferences and preserves a legacy opt-out", () => {
    const preferences = normalizeAgentPreferences({ tone: "untrusted prompt", morningHour: "x".repeat(10000), eveningHour: Infinity, useGeminiFallback: false, extra: "secret" });
    expect(preferences).toMatchObject({ tone: "warm", morningHour: 9, eveningHour: 20, useGemini: false });
    expect(JSON.stringify(preferences).length).toBeLessThan(300);
  });
  it.each(["2026-11-04T15:00:00Z", "2027-02-30T15:00:00Z", "2027-01-01T15:00:00", "not-a-date"])("rejects invalid date %s", (value) => expect(() => assertFutureDate(value, now)).toThrow());
  it.each([0, -10, Infinity, NaN, 525601, 1.5, "10"])("rejects unsafe postpone value %s", (value) => expect(() => assertMinutes(value)).toThrow());
  it.each([null, {}, { intent: "delete_everything", confidence: 1, reply: "ok" }, { intent: "greeting", confidence: 2, reply: "ok" }, { intent: "greeting", confidence: 1, reply: "ok", uid: "victim" }])("rejects malformed decision", (value) => expect(() => parseGeminiDecision(value, now, [])).toThrow());
  it("rejects missing fields for actionable requests", () => expect(() => parseGeminiDecision({ intent: "create_reminder", confidence: 1, reply: "ok", title: "Llamar" }, now, [])).toThrow());
  it("accepts a future ISO date with explicit offset", () => expect(() => assertFutureDate("2026-11-06T09:00:00-05:00", now)).not.toThrow());
});
