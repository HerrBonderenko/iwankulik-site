// Stored XSS і mass assignment: маркер кладеться через справжній API
// адмінки, потім перевіряється, ЯК він виходить на публічній сторінці.
// Payload безвредний: <b>, лапки, кутові дужки (розділ 8 ТЗ аудиту).
import { describe, it, expect, beforeAll } from "vitest";
import { BASE, login, sleep } from "./helpers.mjs";

const MARK = `<b>audit-marker</b>"'&<>`;

let cookie;
let saved;

async function getData() {
  const res = await fetch(`${BASE}/api/admin/data`, { headers: { cookie } });
  return res.json();
}

async function putData(data) {
  return fetch(`${BASE}/api/admin/data`, {
    method: "PUT",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ISR: після збереження сторінка перегенеровується не миттєво.
async function fetchPageWithMarker(url, needle, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  let html = "";
  while (Date.now() < until) {
    html = await (await fetch(`${BASE}${url}`)).text();
    if (html.includes(needle)) return html;
    await sleep(500);
  }
  return html;
}

beforeAll(async () => {
  cookie = await login();
  const data = await getData();

  // Маркер — у назву першої роботи (галерея, JSON-LD, метадані).
  data.paintings[0].title = { uk: MARK, ru: MARK, en: MARK, pl: MARK, de: MARK };

  // Mass assignment одночасно: підмінюємо те, що сервер тримає за собою.
  saved = {
    origSlug: data.cycles[0].slug,
    origCode: data.paintings[0].code,
  };
  data.cycles[0].slug = "podmenen-zloumyshlennikom";
  data.paintings[0].code = "К-999";
  data.paintings[0].cycle = "nesushchestvuyushchiy-cikl";
  data.paintings[0].price = "€ 1 evil";

  const res = await putData(data);
  expect(res.status).toBe(200);
  saved.response = (await res.json()).data;
});

describe("stored XSS на публічній сторінці", () => {
  it("маркер виходить екранованим, сирого тега немає", async () => {
    const html = await fetchPageWithMarker("/uk/zhyvopys", "audit-marker");
    expect(html).toContain("audit-marker");
    // Сирий тег — це і був би XSS.
    expect(html).not.toContain("<b>audit-marker</b>");
    // Екранована форма — правильний вихід.
    expect(html).toContain("&lt;b&gt;audit-marker&lt;/b&gt;");
  });

  it("у JSON-LD «<» екранований — розірвати </script> нічим", async () => {
    const html = await fetchPageWithMarker("/uk/zhyvopys", "audit-marker");
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const block of jsonLd) {
      const body = block.replace(/<\/?script[^>]*>/g, "");
      expect(body).not.toContain("<b>");
      expect(body).not.toContain("</");
    }
  });
});

describe("mass assignment", () => {
  it("slug циклу лишається серверним", () => {
    const cycle = saved.response.cycles.find((c) => c.slug === saved.origSlug);
    expect(cycle, "оригінальний slug мусить зберегтися").toBeTruthy();
    expect(saved.response.cycles.some((c) => c.slug === "podmenen-zloumyshlennikom")).toBe(false);
  });

  it("номер роботи видає сервер, а не клієнт", () => {
    expect(saved.response.paintings[0].code).toBe(saved.origCode);
    expect(saved.response.paintings[0].code).not.toBe("К-999");
  });

  it("неіснуючий цикл гаситься в null, ціна нормалізується", () => {
    expect(saved.response.paintings[0].cycle).toBeNull();
    expect(saved.response.paintings[0].price).toBe("1");
  });
});

describe("схема посилання контактів (R-04)", () => {
  it("javascript: і data: відкидаються на збереженні", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>"]) {
      const data = await getData();
      data.contacts.instagram = bad;
      const res = await putData(data);
      expect(res.status, bad).toBe(400);
    }
  });

  it("https-адреса зберігається", async () => {
    const data = await getData();
    data.contacts.instagram = "https://instagram.com/iwankulik";
    const res = await putData(data);
    expect(res.status).toBe(200);
  });
});
