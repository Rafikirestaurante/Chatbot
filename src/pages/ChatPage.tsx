import { BellRing, BrainCircuit, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyDialogueState, DEFAULT_AGENT_PREFERENCES } from "../agent/defaults";
import { processAgentMessage } from "../agent/core";
import { useAuth } from "../context/AuthContext";
import {
  addMessage,
  addReminder,
  advanceRecurringReminder,
  getAgentDialogueState,
  postponeReminder,
  saveAgentDialogueState,
  subscribeMessages,
  updateReminderDetails,
  updateReminderStatus
} from "../services/data";
import { scheduleLocalNotification } from "../services/notifications";
import { demoMode } from "../config/firebase";
import type { AgentDialogueState, ChatMessage, Reminder } from "../types";
import { ChatBubble } from "../components/ChatBubble";
import { ReminderCard } from "../components/ReminderCard";
import { useReminders } from "../hooks/useReminders";

const STARTER_MESSAGES = [
  "Recuérdame pagar la luz mañana a las 8",
  "¿Qué tengo pendiente?",
  "Todos los lunes a las 9 recuérdame revisar pagos"
];

export function ChatPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentState, setAgentState] = useState<AgentDialogueState>(() =>
    createEmptyDialogueState()
  );
  const endRef = useRef<HTMLDivElement | null>(null);
  const reminders = useReminders(profile?.uid);
  const pending = reminders.filter((item) => item.status === "pending");
  const preferences = useMemo(
    () => ({
      ...DEFAULT_AGENT_PREFERENCES,
      ...(profile?.agentPreferences || {})
    }),
    [profile?.agentPreferences]
  );

  useEffect(() => {
    if (!profile) return;
    return subscribeMessages(profile.uid, setMessages);
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void getAgentDialogueState(profile.uid)
      .then((state) => {
        if (active) setAgentState(state || createEmptyDialogueState());
      })
      .finally(() => {
        if (active) setAgentReady(true);
      });
    return () => {
      active = false;
    };
  }, [profile?.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!demoMode || !profile) return;
    pending.forEach((reminder) => {
      scheduleLocalNotification(
        reminder.id,
        reminder.title,
        reminder.nextTriggerAt,
        () => {
          void addMessage(profile.uid, {
            role: "assistant",
            text: `🔔 Es hora de: ${reminder.title}`,
            reminderId: reminder.id,
            createdAt: new Date().toISOString(),
            deliveryState: "sent",
            agentIntent: "reminder_notification",
            agentConfidence: 1
          });
          void advanceRecurringReminder(profile.uid, reminder);
        }
      );
    });
  }, [pending, profile?.uid]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || !text.trim() || busy || !agentReady) return;

    const userText = text.trim();
    setText("");
    setBusy(true);

    try {
      const sourceMessageId = await addMessage(profile.uid, {
        role: "user",
        text: userText,
        createdAt: new Date().toISOString(),
        deliveryState: "sent"
      });

      const decision = processAgentMessage({
        input: userText,
        now: new Date(),
        timezone: profile.timezone || "America/Bogota",
        reminders,
        preferences,
        state: agentState,
        displayName: profile.displayName
      });

      let reminderId: string | undefined;

      if (decision.action.type === "create_reminder") {
        const now = new Date().toISOString();
        const draft: Omit<Reminder, "id"> = {
          title: decision.action.title,
          dueAt: decision.action.dueAt,
          nextTriggerAt: decision.action.dueAt,
          timezone: profile.timezone || "America/Bogota",
          status: "pending",
          recurrence: decision.action.recurrence,
          createdAt: now,
          updatedAt: now,
          notifiedAt: null,
          sourceMessageId
        };
        reminderId = await addReminder(profile.uid, draft);
        if (demoMode) {
          scheduleLocalNotification(
            reminderId,
            decision.action.title,
            decision.action.dueAt
          );
        }
      } else if (decision.action.type === "set_status") {
        reminderId = decision.action.reminderId;
        await updateReminderStatus(
          profile.uid,
          decision.action.reminderId,
          decision.action.status
        );
      } else if (decision.action.type === "postpone_reminder") {
        reminderId = decision.action.reminderId;
        await postponeReminder(
          profile.uid,
          decision.action.reminderId,
          decision.action.minutes
        );
        if (demoMode) {
          scheduleLocalNotification(
            decision.action.reminderId,
            decision.action.reminderTitle,
            decision.action.nextTriggerAt
          );
        }
      } else if (decision.action.type === "update_reminder") {
        reminderId = decision.action.reminderId;
        await updateReminderDetails(profile.uid, decision.action.reminderId, {
          title: decision.action.title,
          dueAt: decision.action.dueAt
        });
        if (demoMode) {
          scheduleLocalNotification(
            decision.action.reminderId,
            decision.action.title,
            decision.action.dueAt
          );
        }
      }

      setAgentState(decision.nextState);
      await saveAgentDialogueState(profile.uid, decision.nextState);

      await addMessage(profile.uid, {
        role: "assistant",
        text: decision.reply,
        reminderId,
        createdAt: new Date().toISOString(),
        deliveryState: "sent",
        agentIntent: decision.intent,
        agentConfidence: decision.confidence
      });
    } catch (cause) {
      await addMessage(profile.uid, {
        role: "assistant",
        text:
          cause instanceof Error
            ? `No pude completar la acción: ${cause.message}`
            : "No pude completar la acción.",
        createdAt: new Date().toISOString(),
        deliveryState: "error",
        agentIntent: "error",
        agentConfidence: 1
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="bot-avatar"><Sparkles size={22} /></div>
        <div className="chat-identity">
          <h1>Rafiki</h1>
          <span><BrainCircuit size={13} /> Agente privado · sin IA externa</span>
        </div>
        <div className="pending-counter" data-count={pending.length}>
          <BellRing size={17} />
          {pending.length} pendientes
        </div>
      </header>

      <section className="chat-scroll">
        <div className="privacy-banner">
          🔒 El agente procesa tus instrucciones dentro de Rafiki. El administrador no puede leer este chat.
        </div>

        {messages.map((message) => {
          const reminder = message.reminderId
            ? reminders.find((item) => item.id === message.reminderId)
            : undefined;
          return (
            <div key={message.id}>
              <ChatBubble message={message} />
              {reminder && (
                <div className="inline-reminder">
                  <ReminderCard
                    reminder={reminder}
                    compact
                    onComplete={() =>
                      void updateReminderStatus(
                        profile!.uid,
                        reminder.id,
                        "completed"
                      )
                    }
                    onPostpone={() =>
                      void postponeReminder(profile!.uid, reminder.id, 10)
                    }
                    onCancel={() =>
                      void updateReminderStatus(
                        profile!.uid,
                        reminder.id,
                        "cancelled"
                      )
                    }
                  />
                </div>
              )}
            </div>
          );
        })}

        {messages.length <= 1 && (
          <div className="starter-chips" aria-label="Ejemplos">
            {STARTER_MESSAGES.map((message) => (
              <button key={message} onClick={() => setText(message)}>
                {message}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </section>

      <form className="message-composer" onSubmit={send}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={agentState.pending ? "Responde para completar el recordatorio…" : "Escribe un mensaje para Rafiki…"}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button disabled={busy || !text.trim() || !agentReady} aria-label="Enviar">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
