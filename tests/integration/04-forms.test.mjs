// Публічні форми заявок: honeypot, підписаний одноразовий токен,
// валідація, розмір тіла, ліміт 6/год.
//
// Принцип: спам-фільтр навмисно відповідає 200 {ok:true} і на
// блокування, і на прийом — тому кожен «тихий» випадок перевіряється
// за НАСЛІДКОМ у журналі подій, а не за кодом відповіді. Тест, який
// дивиться лише на 200, був би зелений і тоді, коли спам приймається.
import { describe, it, expect } from "vitest";
import { BASE, postJson, formToken, sleep, waitForLog, uniqueIp } from "./helpers.mjs";

const inquiry = (body, ip) => postJson(`${BASE}/api/inquiry`, body, { "x-vercel-forwarded-for": ip });

// Валідна заявка: токен + пауза понад мінімальні 3 секунди.
async function validBody(ip, extra = {}) {
  const tok = await formToken(ip);
  await sleep(3200);
  return {
    name: "Audit",
    email: "a@example.invalid",
    formTs: tok.ts,
    formSig: tok.sig,
    formNonce: tok.nonce,
    ...extra,
  };
}

describe("боти", () => {
  it("honeypot: тихий 200, а в журналі — spam_blocked/honeypot", async () => {
    const ip = uniqueIp();
    const res = await inquiry({ name: "Bot", email: "bot@example.invalid", website: "http://spam.invalid" }, ip);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const entry = await waitForLog((e) => e.action === "spam_blocked" && e.detail === "honeypot" && e.ip === ip);
    expect(entry, "блокування мусить бути видно в журналі").toBeTruthy();
  });

  it("без токена форми: тихий 200 + spam_blocked/timing", async () => {
    const ip = uniqueIp();
    const res = await inquiry({ name: "Bot", email: "bot@example.invalid" }, ip);
    expect(res.status).toBe(200);
    const entry = await waitForLog((e) => e.action === "spam_blocked" && e.detail === "timing" && e.ip === ip);
    expect(entry).toBeTruthy();
  });

  it("підроблений підпис токена: тихий 200 + spam_blocked/timing", async () => {
    const ip = uniqueIp();
    const res = await inquiry(
      { name: "Bot", email: "bot@example.invalid", formTs: Date.now(), formSig: "deadbeef", formNonce: "aaaa" },
      ip
    );
    expect(res.status).toBe(200);
    const entry = await waitForLog((e) => e.action === "spam_blocked" && e.detail === "timing" && e.ip === ip);
    expect(entry).toBeTruthy();
  });

  it("повтор тим самим токеном: одноразовість nonce", async () => {
    const ip = uniqueIp();
    const body = await validBody(ip);
    // Перша — «чесна»: 502 mail_failed = усі перевірки пройдено, лист не
    // пішов лише тому, що RESEND_API_KEY у тестах навмисно не задано.
    expect((await inquiry(body, ip)).status).toBe(502);
    // Друга тим самим токеном — тихо відбита як спам.
    const res = await inquiry(body, ip);
    expect(res.status).toBe(200);
    const entry = await waitForLog((e) => e.action === "spam_blocked" && e.detail === "nonce_reused" && e.ip === ip);
    expect(entry).toBeTruthy();
  });
});

describe("валідація", () => {
  it("довжина полів: subject 5000 символів — 400 too_long", async () => {
    const ip = uniqueIp();
    const body = await validBody(ip, { subject: "x".repeat(5000) });
    const res = await postJson(`${BASE}/api/inquiry/painting`, body, { "x-vercel-forwarded-for": ip });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("too_long");
  });

  it("тіло понад 64 КБ — 413 ДО розбору", async () => {
    const res = await inquiry({ name: "A", email: "a@example.invalid", comment: "y".repeat(70_000) }, uniqueIp());
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("payload_too_large");
  });

  it("тіло понад 64 КБ на логіні — теж 413", async () => {
    const res = await postJson(
      `${BASE}/api/admin/login`,
      { login: "x".repeat(70_000), password: "y" },
      { "x-vercel-forwarded-for": uniqueIp() }
    );
    expect(res.status).toBe(413);
  });

  it("невалідний email — 400 із кодом для перекладу", async () => {
    const ip = uniqueIp();
    const body = await validBody(ip, { email: "не-email" });
    const res = await inquiry(body, ip);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_email");
  });

  it("масив/обʼєкт замість рядка не проходить", async () => {
    const ip = uniqueIp();
    const body = await validBody(ip, { email: { $ne: null }, name: ["a", "b"] });
    const res = await inquiry(body, ip);
    expect(res.status).toBe(400);
  });
});

describe("ліміт заявок", () => {
  it("сьома заявка за годину з одного адреса — 429", async () => {
    const ip = "198.51.100.50";
    // Токени набираємо заздалегідь, пауза одна на всіх — так тест іде
    // ~4 секунди, а не 6 × 3.2.
    const tokens = [];
    for (let i = 0; i < 7; i++) tokens.push(await formToken(ip));
    await sleep(3200);
    const results = [];
    for (const tok of tokens) {
      const res = await inquiry(
        { name: "Audit", email: "a@example.invalid", formTs: tok.ts, formSig: tok.sig, formNonce: tok.nonce },
        ip
      );
      results.push(res.status);
    }
    // 502 = пройшов усі перевірки (пошта в тестах вимкнена), 429 = ліміт.
    expect(results.slice(0, 6)).toEqual([502, 502, 502, 502, 502, 502]);
    expect(results[6]).toBe(429);
  });
});
