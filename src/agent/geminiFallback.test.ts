import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../config/firebase", () => ({ demoMode: false, auth: { currentUser: { getIdToken: vi.fn(async () => "test-token") } } }));
import { processHybridAgentMessage, isGeminiEnabled } from "./geminiFallback";
import { DEFAULT_AGENT_PREFERENCES, createEmptyDialogueState } from "./defaults";
import type { AgentContext } from "./types";

const now = new Date("2026-11-05T15:00:00Z");
function context(): AgentContext {
  return { input: "Recuérdame llamar mañana a las 9", now, timezone: "America/Bogota", reminders: [], preferences: DEFAULT_AGENT_PREFERENCES, state: createEmptyDialogueState(now) };
}
function respond(decision: unknown, status = 200) { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: status === 200, decision }), { status }))); }
describe("Gemini principal", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("consults Gemini even when Core understands the command", async () => {
    respond({ intent: "create_reminder", confidence: 0.95, reply: "Propuesta", title: "Llamar a Ana", dueAtIso: "2026-11-06T14:00:00Z" });
    const result = await processHybridAgentMessage(context());
    expect(result.source).toBe("gemini");
    expect(result.action).toMatchObject({ type: "create_reminder", title: "Llamar a Ana" });
    expect(fetch).toHaveBeenCalledWith("/api/gemini", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }), body: JSON.stringify({ input: context().input }) }));
  });
  it.each([401, 403, 429, 422, 500])("never executes local fallback after HTTP %s", async (status) => {
    respond(null, status);
    await expect(processHybridAgentMessage(context())).rejects.toThrow();
  });
  it("uses validated Core on provider outage and explains it", async () => {
    respond(null, 502);
    const result = await processHybridAgentMessage(context());
    expect(result.source).toBe("local");
    expect(result.action.type).toBe("create_reminder");
    expect(result.reply).toContain("modo local");
  });
  it("respects both explicit opt-out and legacy opt-out", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const ctx = context(); ctx.preferences = { ...ctx.preferences, useGeminiFallback: false };
    expect((await processHybridAgentMessage(ctx)).source).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
    expect(isGeminiEnabled({ ...ctx.preferences, useGemini: true })).toBe(true);
  });
  it("does not execute low confidence proposals", async () => {
    respond({ intent: "create_reminder", confidence: 0.4, reply: "Listo", title: "Llamar", dueAtIso: "2026-11-06T14:00:00Z" });
    expect((await processHybridAgentMessage(context())).action.type).toBe("none");
  });
  it("keeps clarification state and clears it on cancellation", async () => {
    respond({ intent: "create_reminder", confidence: 0.95, reply: "¿A qué hora?", title: "Llamar", needsClarification: true, missingFields: ["time"] });
    const ctx = context(); const first = await processHybridAgentMessage(ctx);
    expect(first.action.type).toBe("none"); expect(first.nextState.pending?.kind).toBe("create_reminder");
    respond({ intent: "cancel_dialogue", confidence: 1, reply: "Cancelado" });
    expect((await processHybridAgentMessage({ ...ctx, state: first.nextState })).nextState.pending).toBeNull();
  });
  it("rejects a fabricated reminder ID", async () => {
    respond({ intent: "cancel_reminder", confidence: 1, reply: "Cancelado", targetReminderId: "other-users-reminder" });
    await expect(processHybridAgentMessage(context())).rejects.toThrow("no pertenece");
  });
});
