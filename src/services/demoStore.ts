import { DEFAULT_AGENT_PREFERENCES, createEmptyDialogueState } from "../agent/defaults";
import type { AgentDialogueState, AppUser, ChatMessage, Reminder } from "../types";

const KEYS = {
  messages: "rafiki-demo-messages-v2",
  reminders: "rafiki-demo-reminders-v2",
  agentState: "rafiki-demo-agent-state-v2",
  user: "rafiki-demo-user-v2"
};

const nowIso = () => new Date().toISOString();

const DEFAULT_DEMO_USER: AppUser = {
  uid: "demo-rafael",
  email: "demo@rafiki.local",
  displayName: "Usuario demo",
  status: "active",
  role: "platform_admin",
  timezone: "America/Bogota",
  agentPreferences: DEFAULT_AGENT_PREFERENCES,
  createdAt: nowIso(),
  lastSeenAt: nowIso()
};

export function getDemoUser(): AppUser {
  return parse(KEYS.user, DEFAULT_DEMO_USER);
}

export function setDemoUser(patch: Partial<AppUser>): void {
  save(KEYS.user, { ...getDemoUser(), ...patch });
}

export const demoUser = DEFAULT_DEMO_USER;

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("rafiki-demo-updated"));
}

export function getDemoMessages(): ChatMessage[] {
  const initial: ChatMessage[] = [
    {
      id: "welcome",
      role: "assistant",
      text:
        "¡Hola! Soy Rafiki, tu agente privado de recordatorios. Puedes decirme: “Recuérdame pagar la luz mañana a las 8”.",
      createdAt: nowIso(),
      deliveryState: "sent",
      agentIntent: "greeting",
      agentConfidence: 1
    }
  ];
  return parse(KEYS.messages, initial);
}

export function setDemoMessages(messages: ChatMessage[]): void {
  save(KEYS.messages, messages);
}

export function getDemoReminders(): Reminder[] {
  return parse(KEYS.reminders, []);
}

export function setDemoReminders(reminders: Reminder[]): void {
  save(KEYS.reminders, reminders);
}

export function getDemoAgentState(): AgentDialogueState {
  return parse(KEYS.agentState, createEmptyDialogueState());
}

export function setDemoAgentState(state: AgentDialogueState): void {
  save(KEYS.agentState, state);
}

export function resetDemoData(): void {
  localStorage.removeItem(KEYS.messages);
  localStorage.removeItem(KEYS.reminders);
  localStorage.removeItem(KEYS.agentState);
  localStorage.removeItem(KEYS.user);
  window.dispatchEvent(new CustomEvent("rafiki-demo-updated"));
}
