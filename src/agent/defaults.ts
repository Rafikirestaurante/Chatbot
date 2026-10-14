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

export function createEmptyDialogueState(now = new Date()): AgentDialogueState {
  return {
    pending: null,
    updatedAt: now.toISOString()
  };
}
