// Ліміти: по чому реально ключується захист від перебору і чи гучно
// вона відмовляє там, де адресу взяти нема звідки (аудит, F-02 і R-02).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BASE, BARE, BARE_CONTENT, BARE_LOG, postJson, waitForLog } from "./helpers.mjs";

function failLogin(base, headers = {}) {
  const { login = "audit", ...rest } = headers;
  return postJson(`${base}/api/admin/login`, { login, password: "wrong-password" }, rest);
}

describe("перебір пароля з довіреним заголовком", () => {
  // Окремий діапазон, щоб не перетнутись із uniqueIp() інших тестів.
  const IP = "198.51.100.7";

  it("шоста невдала спроба з одного адреса — 429", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await failLogin(BASE, { "x-vercel-forwarded-for": IP })).status, `спроба ${i}`).toBe(401);
    }
    expect((await failLogin(BASE, { "x-vercel-forwarded-for": IP })).status).toBe(429);
  });

  it("підроблюваний заголовок блокування не знімає", async () => {
    // Адреса заблокована попереднім тестом; свій x-nf-client-connection-ip
    // на кожен запит раніше давав свіжий лічильник — тепер він ігнорується.
    for (let i = 1; i <= 3; i++) {
      const res = await failLogin(BASE, {
        "x-vercel-forwarded-for": IP,
        "x-nf-client-connection-ip": `192.0.2.${i}`,
      });
      expect(res.status, `підміна ${i}`).toBe(429);
    }
  });
});

describe("площадку не впізнано (R-02)", () => {
  it("відмова лімітера гучна: попередження в консолі сервера", async () => {
    // На bare-сервері немає ні NETLIFY, ні VERCEL, ні TRUSTED_IP_HEADER.
    // Блокування тут неможливе за задумом — але мовчати про це не можна:
    // у логах процесу мусить бути гучне попередження (аудит, R-02).
    const res = await failLogin(BARE, { "x-forwarded-for": "198.51.100.99" });
    expect(res.status).toBe(401);

    // Даємо консолі-стріму дописатись у файл.
    let serverLog = "";
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      serverLog = readFileSync(BARE_LOG, "utf8");
      if (serverLog.includes("ВИМКНЕНІ")) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(serverLog).toContain("[rateLimit]");
    expect(serverLog).toContain("ВИМКНЕНІ");
  });

  it("спроба входу все одно потрапляє в журнал (без IP)", async () => {
    // Окремий запит саме тут: попередження про вимкнений лімітер
    // пишеться лише раз на процес (перший запит уже його виконав), тож
    // цей login_fail не змагається з ним за файл журналу (fs-драйвер має
    // документовану гонку read-modify-write, atomicWrite.js). Позначаємо
    // спробу власним логіном, щоб знайти саме її.
    await failLogin(BARE, { "x-forwarded-for": "198.51.100.123", login: "audit-bare-probe" });
    const entry = await waitForLog(
      (e) => e.action === "login_fail" && /audit-bare-probe/.test(e.detail || ""),
      { contentDir: BARE_CONTENT }
    );
    expect(entry).toBeTruthy();
    expect(entry.ip).toBeNull();
  });
});
