// Аутентифікація адмінки: 401 без сесії, прапорці cookie, CSRF-перевірка
// Origin і — головне — відкликання сесії на виході (аудит, R-01: до
// виправлення стара cookie давала 200 після logout).
import { describe, it, expect } from "vitest";
import { BASE, PASSWORD, postJson, login, uniqueIp } from "./helpers.mjs";

describe("доступ без сесії", () => {
  it("усі admin-маршрути відповідають 401", async () => {
    expect((await fetch(`${BASE}/api/admin/data`)).status).toBe(401);
    expect((await fetch(`${BASE}/api/admin/blog-posts`)).status).toBe(401);
    // PUT — єдиний мутуючий метод data-маршруту (POST його немає, тому
    // POST дав би 405, а не 401); Origin свій, щоб перевіряти саме
    // відсутність сесії, а не CSRF-рубіж.
    expect(
      (await fetch(`${BASE}/api/admin/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Origin: BASE },
        body: "{}",
      })).status
    ).toBe(401);
    expect(
      (await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { Origin: BASE } })).status
    ).toBe(401);
  });
});

describe("вхід", () => {
  it("cookie сесії — HttpOnly, Secure, SameSite=lax, зашифрована", async () => {
    const res = await postJson(
      `${BASE}/api/admin/login`,
      { login: "audit", password: PASSWORD },
      { "x-vercel-forwarded-for": uniqueIp() }
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") || "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    // Формат @hapi/iron: значення зашифроване, а не читабельний JSON/JWT.
    expect(cookie).toContain("of_admin_session=Fe26.2");
  });

  it("невірний пароль — 401 з однаковим текстом", async () => {
    const res = await postJson(
      `${BASE}/api/admin/login`,
      { login: "audit", password: "wrong" },
      { "x-vercel-forwarded-for": uniqueIp() }
    );
    expect(res.status).toBe(401);
  });
});

describe("вихід відкликає сесію (R-01)", () => {
  it("стара cookie після logout більше не пускає", async () => {
    const cookie = await login();

    expect((await fetch(`${BASE}/api/admin/data`, { headers: { cookie } })).status).toBe(200);

    const out = await fetch(`${BASE}/api/admin/logout`, { method: "POST", headers: { cookie } });
    expect(out.status).toBe(200);

    // Саме ТА САМА cookie, збережена до виходу, — сервер мусить
    // відхилити її, хоч вона й криптографічно валідна до кінця ttl.
    expect((await fetch(`${BASE}/api/admin/data`, { headers: { cookie } })).status).toBe(401);
    expect((await fetch(`${BASE}/api/admin/blog-posts`, { headers: { cookie } })).status).toBe(401);
  });

  it("новий вхід після виходу знову працює", async () => {
    const cookie = await login();
    expect((await fetch(`${BASE}/api/admin/data`, { headers: { cookie } })).status).toBe(200);
  });
});

describe("CSRF: чужий Origin", () => {
  it("мутуючі маршрути відповідають 403 навіть із валідною сесією", async () => {
    const cookie = await login();
    const evil = { Origin: "https://evil.example" };

    const put = await fetch(`${BASE}/api/admin/data`, {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json", ...evil },
      body: "{}",
    });
    expect(put.status).toBe(403);

    expect((await fetch(`${BASE}/api/admin/logout`, { method: "POST", headers: { cookie, ...evil } })).status).toBe(403);
    expect((await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie, ...evil } })).status).toBe(403);
    expect((await postJson(`${BASE}/api/admin/login`, { login: "audit", password: PASSWORD }, evil)).status).toBe(403);
  });

  it("свій Origin проходить (GET)", async () => {
    const cookie = await login();
    const res = await fetch(`${BASE}/api/admin/data`, { headers: { cookie, Origin: BASE } });
    expect(res.status).toBe(200);
  });

  it("свій Origin проходить на мутуючому маршруті (R-06)", async () => {
    // Раніше isSameOrigin звіряв Origin із new URL(request.url).host, і
    // збіжний Origin давав 403 — тобто ламав легітимний Save. Тепер має
    // пройти повз CSRF-рубіж (сесії немає, тож очікуємо саме 401, а не
    // 403 і не 200).
    const res = await fetch(`${BASE}/api/admin/data`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
