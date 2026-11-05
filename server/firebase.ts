import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(public status: number, public reason: string, message: string) { super(message); }
}

function services() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new ApiError(503, "server_configuration", "El servidor de Rafiki no está configurado.");
  let app = getApps().find((a) => a.name === "rafiki-api");
  if (!app) {
    try { app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "rafiki-api"); }
    catch { throw new ApiError(503, "invalid_admin_credentials", "Revisa el formato de las credenciales privadas de Firebase en el servidor."); }
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

export async function authorize(headers: Record<string, string | string[] | undefined>) {
  const authorization = headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) throw new ApiError(401, "unauthenticated", "Inicia sesión para utilizar Gemini.");
  const { auth, db } = services();
  let uid: string;
  try { uid = (await auth.verifyIdToken(authorization.slice(7), true)).uid; }
  catch { throw new ApiError(401, "unauthenticated", "La sesión no es válida. Inicia sesión de nuevo."); }
  const ref = db.doc(`platformUsers/${uid}`);
  const profile = (await ref.get()).data();
  if (!profile || profile.status !== "active") throw new ApiError(403, "inactive_user", "Tu cuenta no tiene acceso activo.");
  return { uid, db, profile };
}

// Shared, transactional quota: survives cold starts and multiple server instances.
export async function consumeQuota(uid: string, now: Date) {
  const { db } = services();
  const ref = db.doc(`geminiUsage/${uid}`);
  const minute = Math.floor(now.getTime() / 60000);
  const day = now.toISOString().slice(0, 10);
  await db.runTransaction(async (tx) => {
    const [usage, profile] = await Promise.all([tx.get(ref), tx.get(db.doc(`platformUsers/${uid}`))]);
    if (profile.data()?.status !== "active") throw new ApiError(403, "inactive_user", "Tu cuenta no tiene acceso activo.");
    const data = usage.data();
    const minuteCount = data?.minute === minute ? Number(data.minuteCount) : 0;
    const dayCount = data?.day === day ? Number(data.dayCount) : 0;
    if (minuteCount >= 10 || dayCount >= 200) throw new ApiError(429, "quota_exceeded", "Alcanzaste el límite de consultas. Intenta más tarde.");
    tx.set(ref, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1, updatedAt: Timestamp.fromDate(now) });
  });
}

export function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  throw new Error("Fecha almacenada inválida.");
}
