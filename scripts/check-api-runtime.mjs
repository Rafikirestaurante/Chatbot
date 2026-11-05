import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../api/gemini.js";

// Execute the exact artifact Vercel receives, with no TS loader or mocks.
const source = readFileSync(new URL("../api/gemini.js", import.meta.url), "utf8");
assert.ok(!/from\s+["'][^"']+\.ts["']/.test(source), "Runtime artifact must not import TypeScript sources");
function response() {
  return { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const get = response();
await handler({ method: "GET" }, get);
assert.equal(get.code, 405);
const anonymous = response();
await handler({ method: "POST", headers: {}, body: { input: "Hola" } }, anonymous);
assert.equal(anonymous.code, 401);
assert.equal(anonymous.body.reason, "unauthenticated");
console.log("PASS: compiled API imports and handles GET/anonymous POST without credentials or provider calls.");
