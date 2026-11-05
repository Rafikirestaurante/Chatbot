import type { AgentDialogueState, AgentPreferences } from "./types";

export const DEFAULT_AGENT_PREFERENCES: AgentPreferences = {
  tone: "warm",
  responseLength: "balanced",
  useEmoji: true,
  morningHour: 9,
  afternoonHour: 14,
  eveningHour: 20,
  useGeminiFallback: true
};

// Stored preferences remain user-controlled data, even when read by Admin SDK.
export function normalizeAgentPreferences(value: unknown): AgentPreferences {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const hour = (key: "morningHour" | "afternoonHour" | "eveningHour") => {
    const v = raw[key];
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : DEFAULT_AGENT_PREFERENCES[key];
  };
  return {
    tone: ["warm", "professional", "direct", "motivating"].includes(String(raw.tone)) ? raw.tone as AgentPreferences["tone"] : "warm",
    responseLength: raw.responseLength === "short" ? "short" : "balanced",
    useEmoji: typeof raw.useEmoji === "boolean" ? raw.useEmoji : true,
    morningHour: hour("morningHour"), afternoonHour: hour("afternoonHour"), eveningHour: hour("eveningHour"),
    useGemini: typeof raw.useGemini === "boolean" ? raw.useGemini : typeof raw.useGeminiFallback === "boolean" ? raw.useGeminiFallback : true
  };
}

export function createEmptyDialogueState(now = new Date()): AgentDialogueState {
  return {
    pending: null,
    updatedAt: now.toISOString()
  };
}
