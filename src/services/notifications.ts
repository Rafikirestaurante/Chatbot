import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import type { FirebaseApp } from "firebase/app";
import { demoMode } from "../config/firebase";

export interface NotificationSetupResult {
  enabled: boolean;
  token?: string;
  reason?: string;
}

export async function requestNotifications(
  app: FirebaseApp | null
): Promise<NotificationSetupResult> {
  if (!("Notification" in window)) {
    return { enabled: false, reason: "Este navegador no admite notificaciones." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      enabled: false,
      reason: "El permiso de notificaciones no fue concedido."
    };
  }

  if (demoMode) {
    new Notification("Rafiki Recordatorios", {
      body: "Las notificaciones locales quedaron activadas.",
      icon: "/icons/rafiki-192.png"
    });
    return { enabled: true };
  }

  if (!app || !(await isSupported())) {
    return {
      enabled: false,
      reason: "Firebase Cloud Messaging no es compatible con este navegador."
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    return {
      enabled: false,
      reason: "No fue posible registrar este dispositivo."
    };
  }

  onMessage(messaging, (payload) => {
    const title =
      payload.notification?.title ||
      payload.data?.title ||
      "Rafiki Recordatorios";
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      "Tienes un recordatorio pendiente.";
    new Notification(title, {
      body,
      icon: "/icons/rafiki-192.png",
      data: payload.data
    });
  });

  return { enabled: true, token };
}

const timers = new Map<string, number>();

export function scheduleLocalNotification(
  reminderId: string,
  title: string,
  dueAt: string,
  onTriggered?: () => void
): void {
  if (Notification.permission !== "granted") return;
  const delay = new Date(dueAt).getTime() - Date.now();
  if (delay <= 0 || delay > 2_147_000_000) return;

  const existing = timers.get(reminderId);
  if (existing) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    new Notification("🔔 Rafiki Recordatorios", {
      body: title,
      icon: "/icons/rafiki-192.png",
      tag: reminderId,
      data: { reminderId }
    });
    timers.delete(reminderId);
    onTriggered?.();
  }, delay);

  timers.set(reminderId, timer);
}
