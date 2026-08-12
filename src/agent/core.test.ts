import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_PREFERENCES, createEmptyDialogueState } from "./defaults";
import { processAgentMessage } from "./core";
import type { AgentContext } from "./types";
import type { Reminder } from "../types";

const now = new Date("2026-08-06T12:00:00-05:00");

function context(
  input: string,
  reminders: Reminder[] = [],
  state = createEmptyDialogueState(now)
): AgentContext {
  return {
    input,
    now,
    timezone: "America/Bogota",
    reminders,
    preferences: DEFAULT_AGENT_PREFERENCES,
    state,
    displayName: "Rafael"
  };
}

it("creates a reminder from natural Spanish", () => {
  const decision = processAgentMessage(
    context("Recuérdame pagar la luz mañana a las 8")
  );
  expect(decision.action.type).toBe("create_reminder");
  expect(decision.confidence).toBeGreaterThan(0.9);
  if (decision.action.type === "create_reminder") {
    expect(decision.action.dueAt).toBe("2026-08-07T13:00:00.000Z");
  }
});

it("asks for a missing time and resolves an ambiguous hour", () => {
  const first = processAgentMessage(
    context("Recuérdame llamar al médico mañana")
  );
  expect(first.action.type).toBe("none");
  expect(first.nextState.pending?.missing).toContain("time");

  const second = processAgentMessage(
    context("a las 3", [], first.nextState)
  );
  expect(second.action.type).toBe("none");
  expect(second.reply).toContain("mañana o de la tarde");

  const third = processAgentMessage(
    context("de la tarde", [], second.nextState)
  );
  expect(third.action.type).toBe("create_reminder");
  if (third.action.type === "create_reminder") {
    expect(third.action.dueAt).toBe("2026-08-07T20:00:00.000Z");
  }
});

it("understands relative time before the reminder command", () => {
  const decision = processAgentMessage(
    context("En media hora recuérdame apagar el horno")
  );
  expect(decision.action.type).toBe("create_reminder");
  if (decision.action.type === "create_reminder") {
    expect(decision.action.title).toBe("apagar el horno");
    expect(decision.action.dueAt).toBe("2026-08-06T17:30:00.000Z");
  }
});

it("creates a weekly recurring reminder", () => {
  const decision = processAgentMessage(
    context("Todos los lunes a las 9 recuérdame revisar pagos")
  );
  expect(decision.action.type).toBe("create_reminder");
  if (decision.action.type === "create_reminder") {
    expect(decision.action.title).toBe("revisar pagos");
    expect(decision.action.recurrence.type).toBe("weekly");
  }
});

it("lists tomorrow reminders", () => {
  const reminder: Reminder = {
    id: "r1",
    title: "Pagar internet",
    dueAt: "2026-08-07T13:00:00.000Z",
    nextTriggerAt: "2026-08-07T13:00:00.000Z",
    timezone: "America/Bogota",
    status: "pending",
    recurrence: { type: "none" },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  const decision = processAgentMessage(
    context("¿Qué tengo para mañana?", [reminder])
  );
  expect(decision.action.type).toBe("list_reminders");
  expect(decision.reply).toContain("Pagar internet");
});

describe("reminder actions", () => {
  const reminder: Reminder = {
    id: "r2",
    title: "Llamar a Juan",
    dueAt: "2026-08-07T15:00:00.000Z",
    nextTriggerAt: "2026-08-07T15:00:00.000Z",
    timezone: "America/Bogota",
    status: "pending",
    recurrence: { type: "none" },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  it("completes a referenced reminder", () => {
    const decision = processAgentMessage(
      context("Marca como completado llamar a Juan", [reminder])
    );
    expect(decision.action.type).toBe("set_status");
  });

  it("postpones a reminder", () => {
    const decision = processAgentMessage(
      context("Pospón llamar a Juan 20 minutos", [reminder])
    );
    expect(decision.action.type).toBe("postpone_reminder");
    if (decision.action.type === "postpone_reminder") {
      expect(decision.action.minutes).toBe(20);
    }
  });

  it("cancels the only pending reminder using a pronoun", () => {
    const decision = processAgentMessage(context("Cancela eso", [reminder]));
    expect(decision.action.type).toBe("set_status");
    if (decision.action.type === "set_status") {
      expect(decision.action.status).toBe("cancelled");
    }
  });

  it("reprograms a reminder", () => {
    const decision = processAgentMessage(
      context(
        "Cambia llamar a Juan para el viernes a las 3 de la tarde",
        [reminder]
      )
    );
    expect(decision.action.type).toBe("update_reminder");
    if (decision.action.type === "update_reminder") {
      expect(decision.action.dueAt).toBe("2026-08-07T20:00:00.000Z");
    }
  });

  it("continues a reprogramming conversation", () => {
    const first = processAgentMessage(
      context("Cambia llamar a Juan para el viernes", [reminder])
    );
    expect(first.action.type).toBe("none");
    expect(first.nextState.pending?.kind).toBe("update_reminder");

    const second = processAgentMessage(
      context("a las 3 de la tarde", [reminder], first.nextState)
    );
    expect(second.action.type).toBe("update_reminder");
    if (second.action.type === "update_reminder") {
      expect(second.action.dueAt).toBe("2026-08-07T20:00:00.000Z");
    }
  });
});
