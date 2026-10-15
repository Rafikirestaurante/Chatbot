import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, demoMode, functions } from "../config/firebase";
import { addCalendarDaysInTimezone, getWeekdayInTimezone } from "../agent/dateTime";
import type {
  AdminUserRow,
  AppUser,
  ChatMessage,
  Reminder,
  ReminderStatus,
  AgentDialogueState,
  AgentPreferences
} from "../types";
import {
  getDemoUser,
  setDemoUser,
  getDemoMessages,
  getDemoReminders,
  setDemoMessages,
  setDemoReminders,
  getDemoAgentState,
  setDemoAgentState
} from "./demoStore";

const iso = () => new Date().toISOString();

function assertFirebase(): void {
  if (!db || !functions) {
    throw new Error("Firebase no está configurado.");
  }
}

function mapTimestamp(value: unknown): string {
  if (!value) return iso();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

export async function registerCurrentUser(): Promise<AppUser> {
  if (demoMode) return getDemoUser();
  if (!db) throw new Error("Firebase no está configurado.");

  // 1. Si Cloud Functions está desplegado (Plan Blaze), lo usa primero
  if (functions) {
    try {
      const callable = httpsCallable(functions, "registerCurrentUser");
      const result = await callable();
      return result.data as AppUser;
    } catch {
      // Si el proyecto está en el Plan Spark gratuito (sin Cloud Functions),
      // hace fallback directo a Firestore para no obligar a pagar el Plan Blaze.
    }
  }

  const { auth } = await import("../config/firebase");
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("Debes iniciar sesión.");
  }

  const userRef = doc(db, "platformUsers", currentUser.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    await updateDoc(userRef, {
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(() => undefined);
    const refreshed = await getPlatformUser(currentUser.uid);
    if (refreshed) return refreshed;
  }

  const email = (currentUser.email || "").trim().toLowerCase();
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  const isAdmin = Boolean(adminEmail && email === adminEmail);

  const newProfile: AppUser = {
    uid: currentUser.uid,
    email,
    displayName: currentUser.displayName || email.split("@")[0] || "Usuario",
    photoURL: currentUser.photoURL || null,
    status: "active",
    role: isAdmin ? "platform_admin" : "user",
    timezone: "America/Bogota",
    agentPreferences: {
      tone: "warm",
      responseLength: "balanced",
      useEmoji: true,
      morningHour: 9,
      afternoonHour: 14,
      eveningHour: 20,
      useGeminiFallback: true
    },
    reminderCount: 0,
    deviceCount: 0,
    createdAt: iso(),
    lastSeenAt: iso()
  };

  await setDoc(userRef, {
    ...newProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp()
  });

  await addDoc(collection(db, "users", currentUser.uid, "messages"), {
    role: "assistant",
    text: "¡Hola! Soy Rafiki, tu agente híbrido de recordatorios. Puedes decirme: “Recuérdame pagar la luz mañana a las 8”.",
    deliveryState: "sent",
    createdAt: serverTimestamp()
  });

  return newProfile;
}

export async function getPlatformUser(uid: string): Promise<AppUser | null> {
  if (demoMode) return getDemoUser();
  if (!db) return null;
  const snap = await getDoc(doc(db, "platformUsers", uid));
  if (!snap.exists()) return null;
  const value = snap.data();
  return {
    ...(value as AppUser),
    createdAt: mapTimestamp(value.createdAt),
    lastSeenAt: mapTimestamp(value.lastSeenAt)
  };
}

export async function updatePlatformUser(
  uid: string,
  patch: Pick<AppUser, "displayName" | "timezone"> & { agentPreferences?: AgentPreferences }
): Promise<void> {
  if (demoMode) {
    setDemoUser(patch);
    return;
  }
  if (!db) throw new Error("Firebase no está configurado.");
  await updateDoc(doc(db, "platformUsers", uid), {
    ...patch,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


export async function getAgentDialogueState(
  uid: string
): Promise<AgentDialogueState | null> {
  if (demoMode) return getDemoAgentState();
  if (!db) throw new Error("Firebase no está configurado.");
  const snapshot = await getDoc(doc(db, "users", uid, "agent", "session"));
  if (!snapshot.exists()) return null;
  return snapshot.data() as AgentDialogueState;
}

export async function saveAgentDialogueState(
  uid: string,
  state: AgentDialogueState
): Promise<void> {
  if (demoMode) {
    setDemoAgentState(state);
    return;
  }
  if (!db) throw new Error("Firebase no está configurado.");
  await setDoc(doc(db, "users", uid, "agent", "session"), state, { merge: false });
}

export function subscribeMessages(
  uid: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  if (demoMode) {
    const emit = () => callback(getDemoMessages());
    emit();
    window.addEventListener("rafiki-demo-updated", emit);
    return () => window.removeEventListener("rafiki-demo-updated", emit);
  }

  if (!db) return () => undefined;
  const messagesRef = collection(db, "users", uid, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => {
        const value = item.data();
        return {
          id: item.id,
          role: value.role,
          text: value.text,
          reminderId: value.reminderId,
          deliveryState: value.deliveryState || "sent",
          agentIntent: value.agentIntent,
          agentConfidence: value.agentConfidence,
          createdAt: mapTimestamp(value.createdAt)
        } as ChatMessage;
      })
    );
  });
}

export async function addMessage(
  uid: string,
  message: Omit<ChatMessage, "id">
): Promise<string> {
  if (demoMode) {
    const id = crypto.randomUUID();
    setDemoMessages([...getDemoMessages(), { ...message, id }]);
    return id;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const ref = await addDoc(collection(db, "users", uid, "messages"), {
    ...Object.fromEntries(Object.entries(message).filter(([, value]) => value !== undefined)),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function subscribeReminders(
  uid: string,
  callback: (reminders: Reminder[]) => void
): () => void {
  if (demoMode) {
    const emit = () =>
      callback(
        [...getDemoReminders()].sort(
          (a, b) =>
            new Date(a.nextTriggerAt).getTime() -
            new Date(b.nextTriggerAt).getTime()
        )
      );
    emit();
    window.addEventListener("rafiki-demo-updated", emit);
    return () => window.removeEventListener("rafiki-demo-updated", emit);
  }

  if (!db) return () => undefined;
  const remindersRef = collection(db, "users", uid, "reminders");
  const q = query(remindersRef, orderBy("nextTriggerAt", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => {
        const value = item.data();
        return {
          ...value,
          id: item.id,
          dueAt: mapTimestamp(value.dueAt),
          nextTriggerAt: mapTimestamp(value.nextTriggerAt),
          createdAt: mapTimestamp(value.createdAt),
          updatedAt: mapTimestamp(value.updatedAt),
          notifiedAt: value.notifiedAt ? mapTimestamp(value.notifiedAt) : null
        } as Reminder;
      })
    );
  });
}

export async function addReminder(
  uid: string,
  reminder: Omit<Reminder, "id">
): Promise<string> {
  if (demoMode) {
    const id = crypto.randomUUID();
    setDemoReminders([...getDemoReminders(), { ...reminder, id }]);
    return id;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const ref = await addDoc(collection(db, "users", uid, "reminders"), {
    ...reminder,
    dueAt: new Date(reminder.dueAt),
    nextTriggerAt: new Date(reminder.nextTriggerAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}


export async function updateReminderDetails(
  uid: string,
  reminderId: string,
  patch: { title: string; dueAt: string }
): Promise<void> {
  if (demoMode) {
    setDemoReminders(
      getDemoReminders().map((item) =>
        item.id === reminderId
          ? {
              ...item,
              title: patch.title,
              dueAt: patch.dueAt,
              nextTriggerAt: patch.dueAt,
              notifiedAt: null,
              status: "pending",
              updatedAt: iso()
            }
          : item
      )
    );
    return;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const dueAt = new Date(patch.dueAt);
  await updateDoc(doc(db, "users", uid, "reminders", reminderId), {
    title: patch.title,
    dueAt,
    nextTriggerAt: dueAt,
    notifiedAt: null,
    status: "pending",
    updatedAt: serverTimestamp()
  });
}

function calculateNextOccurrence(reminder: Reminder): string | null {
  if (reminder.recurrence.type === "none") return null;
  const timezone = reminder.timezone || "America/Bogota";
  let next = new Date(reminder.nextTriggerAt);

  if (reminder.recurrence.type === "daily") {
    next = addCalendarDaysInTimezone(next, 1, timezone);
  } else if (reminder.recurrence.type === "weekly") {
    next = addCalendarDaysInTimezone(next, 7, timezone);
  } else if (reminder.recurrence.type === "weekdays") {
    do {
      next = addCalendarDaysInTimezone(next, 1, timezone);
    } while (
      getWeekdayInTimezone(next, timezone) === 0 ||
      getWeekdayInTimezone(next, timezone) === 6
    );
  }

  return next.toISOString();
}

export async function advanceRecurringReminder(
  uid: string,
  reminder: Reminder
): Promise<void> {
  const next = calculateNextOccurrence(reminder);
  if (!next) return;

  if (demoMode) {
    setDemoReminders(
      getDemoReminders().map((item) =>
        item.id === reminder.id
          ? {
              ...item,
              dueAt: next,
              nextTriggerAt: next,
              notifiedAt: null,
              status: "pending",
              updatedAt: iso()
            }
          : item
      )
    );
    return;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const nextDate = new Date(next);
  await updateDoc(doc(db, "users", uid, "reminders", reminder.id), {
    dueAt: nextDate,
    nextTriggerAt: nextDate,
    notifiedAt: null,
    status: "pending",
    updatedAt: serverTimestamp()
  });
}

export async function updateReminderStatus(
  uid: string,
  reminderId: string,
  status: ReminderStatus
): Promise<void> {
  if (demoMode) {
    setDemoReminders(
      getDemoReminders().map((item) =>
        item.id === reminderId
          ? { ...item, status, updatedAt: iso() }
          : item
      )
    );
    return;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  await updateDoc(doc(db, "users", uid, "reminders", reminderId), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function postponeReminder(
  uid: string,
  reminderId: string,
  minutes: number
): Promise<void> {
  if (demoMode) {
    setDemoReminders(
      getDemoReminders().map((item) => {
        if (item.id !== reminderId) return item;
        const next = new Date(Date.now() + minutes * 60_000).toISOString();
        return {
          ...item,
          dueAt: next,
          nextTriggerAt: next,
          status: "pending",
          notifiedAt: null,
          updatedAt: iso()
        };
      })
    );
    return;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const next = new Date(Date.now() + minutes * 60_000);
  await updateDoc(doc(db, "users", uid, "reminders", reminderId), {
    dueAt: next,
    nextTriggerAt: next,
    status: "pending",
    notifiedAt: null,
    updatedAt: serverTimestamp()
  });
}

export async function deleteReminder(
  uid: string,
  reminderId: string
): Promise<void> {
  if (demoMode) {
    setDemoReminders(
      getDemoReminders().filter((item) => item.id !== reminderId)
    );
    return;
  }

  if (!db) throw new Error("Firebase no está configurado.");
  await deleteDoc(doc(db, "users", uid, "reminders", reminderId));
}

export async function saveDeviceToken(
  uid: string,
  token: string,
  label: string
): Promise<void> {
  if (demoMode) return;
  if (!db) throw new Error("Firebase no está configurado.");
  const id = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(token))
    .then((buffer) =>
      Array.from(new Uint8Array(buffer))
        .slice(0, 16)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );

  await setDoc(
    doc(db, "users", uid, "devices", id),
    {
      token,
      label,
      userAgent: navigator.userAgent,
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  if (demoMode) {
    return [
      getDemoUser(),
      {
        uid: "demo-amigo",
        email: "amigo@ejemplo.com",
        displayName: "Amigo pendiente",
        status: "pending",
        role: "user",
        timezone: "America/Bogota",
        createdAt: iso(),
        lastSeenAt: iso(),
        reminderCount: 0,
        deviceCount: 0
      }
    ];
  }

  if (!db) throw new Error("Firebase no está configurado.");
  const snapshot = await getDocs(
    query(collection(db, "platformUsers"), orderBy("createdAt", "desc"), limit(200))
  );
  return snapshot.docs.map((item) => {
    const value = item.data();
    return {
      ...(value as AdminUserRow),
      createdAt: mapTimestamp(value.createdAt),
      lastSeenAt: mapTimestamp(value.lastSeenAt)
    };
  });
}

export async function adminSetUserStatus(
  uid: string,
  status: "active" | "suspended"
): Promise<void> {
  if (demoMode) return;
  assertFirebase();
  const callable = httpsCallable(functions!, "adminSetUserStatus");
  await callable({ uid, status });
}

export async function adminInviteEmail(email: string): Promise<void> {
  if (demoMode) return;
  assertFirebase();
  const callable = httpsCallable(functions!, "adminInviteEmail");
  await callable({ email });
}
