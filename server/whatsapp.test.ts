import { describe, expect, it, vi } from "vitest";
import { parseIncoming, verifyWebhook, sendText } from "./whatsapp";
it("returns Meta's challenge only with the private verify token", () => {
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "rafiki-whatsapp-verificacion-2026"); vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token"); vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1363106930226936");
  expect(verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "rafiki-whatsapp-verificacion-2026", "hub.challenge": "123" })).toBe("123");
  expect(() => verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "123" })).toThrow();
});
it("extracts only bounded inbound text messages", () => {
  expect(parseIncoming({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ from: "573013707032", id: "wamid.1", type: "text", text: { body: "Hola Rafiki" } }] } }] }] })).toEqual([{ from: "573013707032", messageId: "wamid.1", text: "Hola Rafiki" }]);
  expect(parseIncoming({ object: "other", entry: [] })).toEqual([]);
});
it("sends through the configured phone number id and never puts token in URL", async () => {
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token"); vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1363106930226936"); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  await sendText("573013707032", "Hola");
  const [url, init] = vi.mocked(fetch).mock.calls[0]; expect(String(url)).not.toContain("test-token"); expect(String(url)).toContain("1363106930226936"); expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
});
