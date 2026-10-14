import type { Recurrence, Reminder, ReminderStatus } from "../types";

export type AgentIntent =
  | "create_reminder"
  | "list_reminders"
  | "complete_reminder"
  | "cancel_reminder"
  | "postpone_reminder"
  | "update_reminder"
  | "greeting"
  | "help"
  | "cancel_dialogue"
  | "unknown";

export type AgentTone = "warm" | "professional" | "direct" | "motivating";
export type AgentResponseLength = "short" | "balanced";

export interface AgentPreferences {
  tone: AgentTone;
  responseLength: AgentResponseLength;
  useEmoji: boolean;
  morningHour: number;
  afternoonHour: number;
  eveningHour: number;
  useGeminiFallback?: boolean;
}

export type PendingDialogue =
  | {
      kind: "create_reminder";
      originalInput: string;
      missing: Array<"title" | "date" | "time">;
      createdAt: string;
    }
  | {
      kind: "update_reminder";
      originalInput: string;
      reminderId: string;
      reminderTitle: string;
      missing: Array<"date" | "time">;
      createdAt: string;
    };

export interface AgentDialogueState {
  pending: PendingDialogue | null;
  lastReferencedReminderId?: string;
  updatedAt: string;
}

export type ReminderListFilter = "pending" | "today" | "tomorrow" | "week" | "all";

export type AgentAction =
  | {
      type: "create_reminder";
      title: string;
      dueAt: string;
      recurrence: Recurrence;
    }
  | {
      type: "list_reminders";
      filter: ReminderListFilter;
    }
  | {
      type: "set_status";
      reminderId: string;
      reminderTitle: string;
      status: Extract<ReminderStatus, "completed" | "cancelled">;
    }
  | {
      type: "postpone_reminder";
      reminderId: string;
      reminderTitle: string;
      minutes: number;
      nextTriggerAt: string;
    }
  | {
      type: "update_reminder";
      reminderId: string;
      reminderTitle: string;
      title: string;
      dueAt: string;
    }
  | { type: "none" };

export interface AgentDecision {
  intent: AgentIntent;
  confidence: number;
  action: AgentAction;
  reply: string;
  nextState: AgentDialogueState;
  referencedReminder?: Reminder;
  source?: "local" | "gemini";
}

export interface AgentContext {
  input: string;
  now: Date;
  timezone: string;
  reminders: Reminder[];
  preferences: AgentPreferences;
  state: AgentDialogueState;
  displayName?: string;
}
