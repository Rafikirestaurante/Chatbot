import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
let env: RulesTestEnvironment;
const profile = (uid: string, status = "active", role = "user") => ({ uid, email: `${uid}@example.invalid`, displayName: uid, status, role, timezone: "America/Bogota", reminderCount: 0, deviceCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const reminder = () => ({ title: "Llamar", dueAt: Timestamp.fromMillis(Date.now() + 3600000), nextTriggerAt: Timestamp.fromMillis(Date.now() + 3600000), timezone: "America/Bogota", status: "pending", recurrence: { type: "none" }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({ projectId: "demo-rafiki-061", firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") } });
}, 30000);
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "platformUsers/alice"), profile("alice")),
      setDoc(doc(db, "platformUsers/bob"), profile("bob")),
      setDoc(doc(db, "platformUsers/admin"), profile("admin", "active", "platform_admin")),
      setDoc(doc(db, "platformUsers/forged"), profile("forged", "active", "platform_admin")),
      setDoc(doc(db, "platformUsers/suspended"), profile("suspended", "suspended")),
      setDoc(doc(db, "users/alice/reminders/r1"), reminder()),
      setDoc(doc(db, "users/bob/messages/private"), { text: "privado" })
    ]);
  });
});
afterAll(async () => env?.cleanup());
describe("Firestore access boundaries", () => {
  it("permits only pending regular-user self registration", async () => {
    const db = env.authenticatedContext("new", { email: "new@example.invalid" }).firestore();
    await assertFails(setDoc(doc(db, "platformUsers/new"), profile("new", "active", "platform_admin")));
    await assertFails(setDoc(doc(db, "platformUsers/new"), profile("new", "active")));
    await assertSucceeds(setDoc(doc(db, "platformUsers/new"), profile("new", "pending")));
  });
  it("prevents self promotion and self activation", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "platformUsers/alice"), { role: "platform_admin" }));
    const suspended = env.authenticatedContext("suspended").firestore();
    await assertFails(updateDoc(doc(suspended, "platformUsers/suspended"), { status: "active" }));
  });
  it("does not trust a forged administrator document", async () => {
    const db = env.authenticatedContext("forged").firestore();
    await assertFails(getDocs(collection(db, "platformUsers")));
    await assertFails(updateDoc(doc(db, "platformUsers/alice"), { status: "suspended" }));
  });
  it("permits a trusted active admin to approve a user but never read private content", async () => {
    const db = env.authenticatedContext("admin", { platform_admin: true }).firestore();
    await assertSucceeds(getDocs(collection(db, "platformUsers")));
    await assertSucceeds(updateDoc(doc(db, "platformUsers/alice"), { status: "suspended", updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, "users/bob/messages/private")));
    await assertFails(getDoc(doc(db, "users/alice/reminders/r1")));
  });
  it("denies anonymous and cross-user content access", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice/reminders/r1")));
    const db = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(db, "users/alice/reminders/r1")));
    await assertFails(updateDoc(doc(db, "users/alice/reminders/r1"), { status: "completed", updatedAt: serverTimestamp() }));
  });
  it("accepts a valid reminder and denies past dates and blank titles", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "users/alice/reminders/new"), reminder()));
    await assertFails(setDoc(doc(db, "users/alice/reminders/past"), { ...reminder(), dueAt: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(db, "users/alice/reminders/blank"), { ...reminder(), title: "   " }));
  });
  it("blocks suspension and quota tampering", async () => {
    const db = env.authenticatedContext("suspended").firestore();
    await assertFails(setDoc(doc(db, "users/suspended/reminders/new"), reminder()));
    await assertFails(setDoc(doc(env.authenticatedContext("alice").firestore(), "geminiUsage/alice"), { dayCount: 0 }));
  });
  it("prevents stale transitions and preserves original creation metadata", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "users/alice/reminders/r1"), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "users/alice/reminders/r1"), { status: "completed", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "users/alice/reminders/r1"), { status: "cancelled", updatedAt: serverTimestamp() }));
  });
});
