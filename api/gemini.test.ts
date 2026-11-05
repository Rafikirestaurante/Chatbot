import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../server/firebase.ts", async (original) => {
  const actual = await original<typeof import("../server/firebase.ts")>();
  return { ...actual, authorize: vi.fn(), consumeQuota: vi.fn() };
});
import handler from "./gemini";
import { authorize, consumeQuota, ApiError } from "../server/firebase.ts";
const storedReminder = { id: "own-reminder", data: () => ({ title: "Actividad privada", nextTriggerAt: "2027-01-01T12:00:00Z", recurrence: { type: "none" } }) };
const collection = { where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), get: vi.fn(async () => ({ docs: [storedReminder] })) };
collection.where.mockReturnValue(collection); collection.orderBy.mockReturnValue(collection); collection.limit.mockReturnValue(collection);
const db = { collection: vi.fn(() => collection), doc: vi.fn(() => ({ get: vi.fn(async () => ({ data: () => ({ pending: null }) })) })) };
function response() { return { code: 0, body: null as any, setHeader: vi.fn(), status(n: number) { this.code = n; return this; }, json(v: any) { this.body = v; return this; } }; }
const request = () => ({ method: "POST", headers: { authorization: "Bearer test" }, body: { input: "Hola" } });
function provider(decision: unknown) { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }] }), { status: 200 }))); }
describe("protected Gemini endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
    vi.mocked(authorize).mockResolvedValue({ uid: "user-a", db, profile: { status: "active", timezone: "America/Bogota" } } as any);
    vi.mocked(consumeQuota).mockResolvedValue(undefined);
    provider({ intent: "greeting", confidence: 1, reply: "Hola" });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("rejects GET before authorizing or querying the provider", async () => {
    const res = response(); await handler({ method: "GET" }, res);
    expect(res.code).toBe(405); expect(authorize).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403])("rejects unauthorized/inactive users (%s) without consuming quota", async (status) => {
    vi.mocked(authorize).mockRejectedValueOnce(new ApiError(status, "denied", "Acceso denegado"));
    const res = response(); await handler(request(), res);
    expect(res.code).toBe(status); expect(consumeQuota).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects user-supplied identity or context", async () => {
    const res = response(); await handler({ ...request(), body: { input: "Hola", uid: "victim", reminders: [] } }, res);
    expect(res.code).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed when no key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", ""); const res = response(); await handler(request(), res);
    expect(res.code).toBe(503); expect(fetch).not.toHaveBeenCalled();
  });
  it("stops exhausted quota before calling Google", async () => {
    vi.mocked(consumeQuota).mockRejectedValueOnce(new ApiError(429, "quota_exceeded", "Límite"));
    const res = response(); await handler(request(), res); expect(res.code).toBe(429); expect(fetch).not.toHaveBeenCalled();
  });
  it("uses only authenticated documents, hides key from URL and response", async () => {
    const res = response(); await handler(request(), res); expect(res.code).toBe(200);
    expect(db.collection).toHaveBeenCalledWith("users/user-a/reminders");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("test-only");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "test-only-not-a-real-key" });
    expect(String(options?.body)).toContain("Actividad privada");
    expect(JSON.stringify(res.body)).not.toContain("test-only");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("rejects a model decision referencing another user's reminder", async () => {
    provider({ intent: "cancel_reminder", confidence: 1, reply: "ok", targetReminderId: "victim-reminder" });
    const res = response(); await handler(request(), res); expect(res.code).toBe(422);
  });
  it("rejects dates in the past", async () => {
    provider({ intent: "create_reminder", confidence: 1, reply: "ok", title: "Llamar", dueAtIso: "2020-01-01T00:00:00Z" });
    const res = response(); await handler(request(), res); expect(res.code).toBe(422);
  });
  it("does not expose provider error bodies or exception messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("test-only-not-a-real-key", { status: 403 })));
    const res = response(); await handler(request(), res); expect(res.code).toBe(502); expect(JSON.stringify(res.body)).not.toContain("test-only");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("test-only-not-a-real-key"); }));
    const error = response(); await handler(request(), error); expect(error.code).toBe(500); expect(JSON.stringify(error.body)).not.toContain("test-only");
  });
});
