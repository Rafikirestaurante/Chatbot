import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  DocumentData,
  FieldValue,
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();

const db = getFirestore();
const REGION = "us-central1";


interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function wallDateFromInstant(date: Date, timezone: string): Date {
  const parts = getZonedParts(date, timezone);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );
}

function wallDateToInstant(wallDate: Date, timezone: string): Date {
  const desiredUtc = Date.UTC(
    wallDate.getUTCFullYear(),
    wallDate.getUTCMonth(),
    wallDate.getUTCDate(),
    wallDate.getUTCHours(),
    wallDate.getUTCMinutes(),
    wallDate.getUTCSeconds()
  );
  let candidate = new Date(desiredUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(candidate, timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const difference = desiredUtc - actualAsUtc;
    if (difference === 0) break;
    candidate = new Date(candidate.getTime() + difference);
  }
  return candidate;
}

function addCalendarDaysInTimezone(
  instant: Date,
  days: number,
  timezone: string
): Date {
  const wallDate = wallDateFromInstant(instant, timezone);
  wallDate.setUTCDate(wallDate.getUTCDate() + days);
  return wallDateToInstant(wallDate, timezone);
}

function getWeekdayInTimezone(instant: Date, timezone: string): number {
  return wallDateFromInstant(instant, timezone).getUTCDay();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function emailKey(value: string): string {
  return normalizeEmail(value).replace(/\//g, "_");
}

function requireAuth(request: {
  auth?: { uid: string; token: Record<string, unknown> } | null;
}) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return request.auth;
}

function requirePlatformAdmin(
  request: { auth?: { uid: string; token: Record<string, unknown> } | null }
) {
  const auth = requireAuth(request);
  if (auth.token.platform_admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "Esta operación requiere Administrador de Plataforma."
    );
  }
  return auth;
}

export const registerCurrentUser = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const auth = requireAuth(request);
    const authUser = await getAuth().getUser(auth.uid);
    const email = normalizeEmail(authUser.email || "");
    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "La cuenta debe tener un correo verificado."
      );
    }

    const userRef = db.doc(`platformUsers/${auth.uid}`);
    const existing = await userRef.get();

    if (existing.exists) {
      await userRef.update({
        displayName: authUser.displayName || existing.data()?.displayName || email,
        photoURL: authUser.photoURL || null,
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      const refreshed = await userRef.get();
      return serializePlatformUser(refreshed.data()!);
    }

    const invitationRef = db.doc(`accessInvitations/${emailKey(email)}`);
    const invitation = await invitationRef.get();
    const invited =
      invitation.exists &&
      invitation.data()?.active === true &&
      invitation.data()?.email === email;

    const role =
      authUser.customClaims?.platform_admin === true
        ? "platform_admin"
        : "user";

    const status = role === "platform_admin" || invited ? "active" : "pending";

    await userRef.set({
      uid: auth.uid,
      email,
      displayName: authUser.displayName || email.split("@")[0],
      photoURL: authUser.photoURL || null,
      status,
      role,
      timezone: "America/Bogota",
      agentPreferences: {
        tone: "warm",
        responseLength: "balanced",
        useEmoji: true,
        morningHour: 9,
        afternoonHour: 14,
        eveningHour: 20
      },
      reminderCount: 0,
      deviceCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp()
    });

    await db.collection(`users/${auth.uid}/messages`).add({
      role: "assistant",
      text:
        "¡Hola! Soy Rafiki, tu agente privado de recordatorios. Puedes decirme: “Recuérdame pagar la luz mañana a las 8”.",
      deliveryState: "sent",
      createdAt: FieldValue.serverTimestamp()
    });

    if (invited) {
      await invitationRef.set(
        {
          active: false,
          acceptedBy: auth.uid,
          acceptedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    const created = await userRef.get();
    return serializePlatformUser(created.data()!);
  }
);

export const adminInviteEmail = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    const admin = requirePlatformAdmin(request);
    const email = normalizeEmail(String(request.data?.email || ""));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Correo electrónico inválido.");
    }

    await db.doc(`accessInvitations/${emailKey(email)}`).set({
      email,
      active: true,
      invitedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return { ok: true };
  }
);

export const adminSetUserStatus = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    requirePlatformAdmin(request);
    const uid = String(request.data?.uid || "");
    const status = String(request.data?.status || "");

    if (!uid || !["active", "suspended"].includes(status)) {
      throw new HttpsError("invalid-argument", "Datos inválidos.");
    }

    const target = await getAuth().getUser(uid);
    if (target.customClaims?.platform_admin === true) {
      throw new HttpsError(
        "failed-precondition",
        "No se puede suspender un administrador desde este panel."
      );
    }

    await db.doc(`platformUsers/${uid}`).update({
      status,
      updatedAt: FieldValue.serverTimestamp()
    });

    if (status === "suspended") {
      await getAuth().revokeRefreshTokens(uid);
    }

    return { ok: true };
  }
);

// Un solo trabajo global. Se puede desplegar pero no hace envíos mientras
// ENABLE_SCHEDULED_PUSH no sea "true".
export const dispatchDueReminders = onSchedule(
  {
    region: REGION,
    schedule: "every 1 minutes",
    timeZone: "America/Bogota",
    maxInstances: 1,
    timeoutSeconds: 55
  },
  async () => {
    if (process.env.ENABLE_SCHEDULED_PUSH !== "true") {
      logger.debug("Push programado desactivado.");
      return;
    }

    const now = Timestamp.now();
    const snapshot = await db
      .collectionGroup("reminders")
      .where("status", "==", "pending")
      .where("nextTriggerAt", "<=", now)
      .limit(100)
      .get();

    for (const reminderDoc of snapshot.docs) {
      const reminder = reminderDoc.data();
      const uid = reminderDoc.ref.parent.parent?.id;
      if (!uid) continue;

      const lock = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(reminderDoc.ref);
        const data = fresh.data();
        if (
          !fresh.exists ||
          data?.status !== "pending" ||
          data?.notifiedAt
        ) {
          return false;
        }
        transaction.update(reminderDoc.ref, {
          notifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return true;
      });

      if (!lock) continue;

      const deviceSnapshot = await db
        .collection(`users/${uid}/devices`)
        .where("enabled", "==", true)
        .get();

      const tokens = deviceSnapshot.docs
        .map((item) => item.data().token as string)
        .filter(Boolean);

      if (tokens.length) {
        const response = await getMessaging().sendEachForMulticast({
          tokens,
          data: {
            title: "🔔 Rafiki Recordatorios",
            body: String(reminder.title || "Tienes un recordatorio pendiente."),
            reminderId: reminderDoc.id
          }
        });

        const invalidTokens = response.responses
          .map((item, index) => ({ item, token: tokens[index] }))
          .filter(({ item }) =>
            [
              "messaging/registration-token-not-registered",
              "messaging/invalid-registration-token"
            ].includes(item.error?.code || "")
          )
          .map(({ token }) => token);

        if (invalidTokens.length) {
          const batch = db.batch();
          deviceSnapshot.docs.forEach((device) => {
            if (invalidTokens.includes(device.data().token)) {
              batch.update(device.ref, {
                enabled: false,
                updatedAt: FieldValue.serverTimestamp()
              });
            }
          });
          await batch.commit();
        }
      }

      await db.collection(`users/${uid}/messages`).add({
        role: "assistant",
        text: `🔔 Es hora de: ${String(reminder.title || "tu recordatorio")}`,
        reminderId: reminderDoc.id,
        deliveryState: "sent",
        createdAt: FieldValue.serverTimestamp()
      });

      const recurrenceType = String(reminder.recurrence?.type || "none");
      if (recurrenceType !== "none") {
        const currentDate =
          reminder.nextTriggerAt instanceof Timestamp
            ? reminder.nextTriggerAt.toDate()
            : new Date(reminder.nextTriggerAt);

        const timezone = String(reminder.timezone || "America/Bogota");
        let nextDate = new Date(currentDate);
        if (recurrenceType === "daily") {
          nextDate = addCalendarDaysInTimezone(nextDate, 1, timezone);
        } else if (recurrenceType === "weekly") {
          nextDate = addCalendarDaysInTimezone(nextDate, 7, timezone);
        } else if (recurrenceType === "weekdays") {
          do {
            nextDate = addCalendarDaysInTimezone(nextDate, 1, timezone);
          } while (
            getWeekdayInTimezone(nextDate, timezone) === 0 ||
            getWeekdayInTimezone(nextDate, timezone) === 6
          );
        }

        await reminderDoc.ref.update({
          dueAt: Timestamp.fromDate(nextDate),
          nextTriggerAt: Timestamp.fromDate(nextDate),
          notifiedAt: null,
          lastNotifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    logger.info("Recordatorios procesados", { count: snapshot.size });
  }
);

function serializePlatformUser(data: DocumentData) {
  const serializeDate = (value: unknown) =>
    value instanceof Timestamp
      ? value.toDate().toISOString()
      : new Date().toISOString();

  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL || null,
    status: data.status,
    role: data.role,
    timezone: data.timezone || "America/Bogota",
    agentPreferences: data.agentPreferences || {
      tone: "warm",
      responseLength: "balanced",
      useEmoji: true,
      morningHour: 9,
      afternoonHour: 14,
      eveningHour: 20
    },
    reminderCount: Number(data.reminderCount || 0),
    deviceCount: Number(data.deviceCount || 0),
    createdAt: serializeDate(data.createdAt),
    lastSeenAt: serializeDate(data.lastSeenAt)
  };
}
