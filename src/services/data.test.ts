import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, functions: {}, demoMode: false }));
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: vi.fn(() => "messages-collection"),
    serverTimestamp: vi.fn(() => "server-time"),
    addDoc: vi.fn(async () => ({ id: "new-message" }))
  };
});

import { addDoc } from "firebase/firestore";
import { addMessage } from "./data";

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
