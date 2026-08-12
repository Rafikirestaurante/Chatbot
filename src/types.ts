import type { AgentDialogueState, AgentPreferences } from "./agent/types";

export type UserStatus = "pending" | "active" | "suspended";
export type UserRole = "user" | "platform_admin";
export type ReminderStatus = "pending" | "completed" | "cancelled";
export type MessageRole = "user" | "assistant" | "system";
export type RecurrenceType = "none" | "daily" | "weekdays" | "weekly";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  status: UserStatus;
  role: UserRole;
  timezone: string;
  agentPreferences?: AgentPreferences;
  createdAt?: string;
  lastSeenAt?: string;
  reminderCount?: number;
  deviceCount?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  reminderId?: string;
  deliveryState?: "sending" | "sent" | "error";
  agentIntent?: string;
  agentConfidence?: number;
}

export interface Recurrence {
  type: RecurrenceType;
  weekday?: number;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  nextTriggerAt: string;
  timezone: string;
  status: ReminderStatus;
  recurrence: Recurrence;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string | null;
  sourceMessageId?: string;
}

export interface ParsedReminder {
  ok: boolean;
  title?: string;
  dueAt?: Date;
  recurrence?: Recurrence;
  clarification?: string;
  confidence: number;
}

export interface NotificationDevice {
  id: string;
  token: string;
  label: string;
  userAgent: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRow extends AppUser {
  lastSeenAt?: string;
}

export type { AgentDialogueState, AgentPreferences };
