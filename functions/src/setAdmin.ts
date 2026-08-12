import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const [email, serviceAccountPath] = process.argv.slice(2);

if (!email || !serviceAccountPath) {
  console.error(
    "Uso: node lib/setAdmin.js correo@ejemplo.com ./service-account.json"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email.trim().toLowerCase());
await auth.setCustomUserClaims(user.uid, { platform_admin: true });

await db.doc(`platformUsers/${user.uid}`).set(
  {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split("@")[0] || "Administrador",
    photoURL: user.photoURL || null,
    status: "active",
    role: "platform_admin",
    timezone: "America/Bogota",
    reminderCount: 0,
    deviceCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp()
  },
  { merge: true }
);

console.log(`Administrador configurado: ${email}`);
