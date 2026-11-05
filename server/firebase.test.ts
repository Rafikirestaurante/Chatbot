import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), get: vi.fn(), run: vi.fn(), set: vi.fn(), usage: {} as Record<string, unknown>, profile: { status: "active" } as Record<string, unknown> }));
vi.mock("firebase-admin/app", () => ({ cert: vi.fn(), getApps: () => [{ name: "rafiki-api" }], initializeApp: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: class { static fromDate(date: Date) { return date; } },
  getFirestore: () => ({ doc: (path: string) => ({ path, get: mocks.get }), runTransaction: mocks.run })
}));
import { authorize, consumeQuota } from "./firebase";
describe("Firebase authorization and persistent quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FIREBASE_PROJECT_ID", "test"); vi.stubEnv("FIREBASE_CLIENT_EMAIL", "test@example.invalid"); vi.stubEnv("FIREBASE_PRIVATE_KEY", "fake-test-key");
    mocks.verify.mockResolvedValue({ uid: "user-a" }); mocks.get.mockResolvedValue({ data: () => mocks.profile });
    mocks.profile = { status: "active" }; mocks.usage = {};
    mocks.run.mockImplementation(async (callback) => callback({ get: async (ref: { path: string }) => ({ data: () => ref.path.startsWith("platformUsers/") ? mocks.profile : mocks.usage }), set: mocks.set }));
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects anonymous requests before accessing Firebase", async () => {
    await expect(authorize({})).rejects.toMatchObject({ status: 401 }); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("checks revoked tokens against the expected project", async () => {
    await expect(authorize({ authorization: "Bearer test-token" })).resolves.toMatchObject({ uid: "user-a" });
    expect(mocks.verify).toHaveBeenCalledWith("test-token", true);
  });
  it("rejects invalid/revoked sessions without leaking verification errors", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("private-error"));
    await expect(authorize({ authorization: "Bearer revoked" })).rejects.toMatchObject({ status: 401 });
  });
  it.each(["pending", "suspended"])("blocks %s accounts", async (status) => {
    mocks.profile = { status }; await expect(authorize({ authorization: "Bearer test" })).rejects.toMatchObject({ status: 403 });
  });
  it("rejects missing server configuration", async () => {
    vi.stubEnv("FIREBASE_PRIVATE_KEY", ""); await expect(authorize({ authorization: "Bearer test" })).rejects.toMatchObject({ status: 503 });
  });
  it("increments quota atomically", async () => {
    await consumeQuota("user-a", new Date("2026-11-05T12:00:00Z"));
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ path: "geminiUsage/user-a" }), expect.objectContaining({ minuteCount: 1, dayCount: 1 }));
  });
  it("blocks the eleventh request in one minute", async () => {
    const now = new Date("2026-11-05T12:00:00Z"); mocks.usage = { minute: Math.floor(now.getTime() / 60000), minuteCount: 10, day: "2026-11-05", dayCount: 10 };
    await expect(consumeQuota("user-a", now)).rejects.toMatchObject({ status: 429 }); expect(mocks.set).not.toHaveBeenCalled();
  });
  it("blocks a new minute after the daily quota", async () => {
    mocks.usage = { day: "2026-11-05", dayCount: 200 };
    await expect(consumeQuota("user-a", new Date("2026-11-05T13:00:00Z"))).rejects.toMatchObject({ status: 429 });
  });
  it("resets the daily quota on a new UTC day", async () => {
    mocks.usage = { day: "2026-11-04", dayCount: 200 };
    await consumeQuota("user-a", new Date("2026-11-05T00:00:01Z"));
    expect(mocks.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dayCount: 1 }));
  });
});
