import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, functions: {}, demoMode: false, auth: { currentUser: { uid: "user-a" } } }));
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    doc: vi.fn((...args) => args.slice(1).join("/")),
    getDoc: vi.fn(async () => ({ data: () => ({ status: "active" }) })),
    updateDoc: vi.fn(),
    collection: vi.fn(() => "messages-collection"),
    serverTimestamp: vi.fn(() => "server-time"),
    addDoc: vi.fn(async () => ({ id: "new-message" }))
  };
});

import { addDoc, getDoc, updateDoc } from "firebase/firestore";
import { addMessage, addReminder, updateReminderStatus, postponeReminder } from "./data";

describe("Firestore message persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("omits undefined optional fields when saving a conversational response", async () => {
    const result = await addMessage("user-a", {
      role: "assistant",
      text: "Hola",
      createdAt: "client-time",
      deliveryState: "sent",
      reminderId: undefined,
      agentIntent: undefined,
      agentConfidence: undefined
    });
    expect(result).toBe("new-message");
    expect(addDoc).toHaveBeenCalledWith("messages-collection", {
      role: "assistant",
      text: "Hola",
      createdAt: "server-time",
      deliveryState: "sent"
    });
  });

  it("keeps a real reminder link and zero confidence", async () => {
    await addMessage("user-a", {
      role: "assistant",
      text: "Programado",
      createdAt: "client-time",
      deliveryState: "sent",
      reminderId: "reminder-a",
      agentIntent: "create_reminder",
      agentConfidence: 0
    });
    expect(addDoc).toHaveBeenCalledWith("messages-collection", {
      role: "assistant",
      text: "Programado",
      createdAt: "server-time",
      deliveryState: "sent",
      reminderId: "reminder-a",
      agentIntent: "create_reminder",
      agentConfidence: 0
    });
  });
});

describe("reminder execution boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getDoc).mockResolvedValue({ data: () => ({ status: "active" }) } as any); });
  it("rejects a request for another user before writing", async () => {
    await expect(updateReminderStatus("victim", "r1", "completed")).rejects.toThrow("sesión");
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it("rejects a suspended user", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ status: "suspended" }) } as any);
    await expect(updateReminderStatus("user-a", "r1", "completed")).rejects.toThrow("activo");
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it("rejects a stale/nonexistent reminder", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ status: "active" }) } as any).mockResolvedValueOnce({ data: () => ({ status: "completed" }) } as any);
    await expect(updateReminderStatus("user-a", "r1", "cancelled")).rejects.toThrow("pendiente");
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it("rejects invalid postponements without writing", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ status: "active" }) } as any).mockResolvedValueOnce({ data: () => ({ status: "pending" }) } as any);
    await expect(postponeReminder("user-a", "r1", Infinity)).rejects.toThrow("plazo");
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it("rejects invalid reminder dates before persistence", async () => {
    await expect(addReminder("user-a", { title: "Llamar", dueAt: "2020-01-01T00:00:00Z", nextTriggerAt: "2020-01-01T00:00:00Z", recurrence: { type: "none" } } as any)).rejects.toThrow("futuras");
    expect(addDoc).not.toHaveBeenCalled();
  });
});
