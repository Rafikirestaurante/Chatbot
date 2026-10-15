/// <reference lib="webworker" />

import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

clientsClaim();
void self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    const title =
      payload.notification?.title ||
      payload.data?.title ||
      "Rafiki Recordatorios";
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      "Tienes un recordatorio pendiente.";

    void self.registration.showNotification(title, {
      body,
      icon: "/icons/rafiki-192.png",
      badge: "/icons/rafiki-192.png",
      tag: payload.data?.reminderId || "rafiki-reminder",
      data: payload.data || {}
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const reminderId = event.notification.data?.reminderId;
  const url = reminderId
    ? `/recordatorios?reminder=${encodeURIComponent(reminderId)}`
    : "/recordatorios";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      async (windowClients) => {
        const existing = windowClients[0];
        if (existing) {
          await existing.focus();
          existing.postMessage({ type: "OPEN_REMINDER", reminderId });
          return;
        }
        await self.clients.openWindow(url);
      }
    )
  );
});
