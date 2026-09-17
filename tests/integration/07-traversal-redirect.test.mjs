// Path traversal у слагах блогу та open redirect у proxy.js.
import { describe, it, expect } from "vitest";
import { BASE } from "./helpers.mjs";

// Редиректи не слідуємо: перевіряємо саме Location.
const get = (p) => fetch(`${BASE}${p}`, { redirect: "manual" });

describe("path traversal у блозі", () => {
  it("закодовані розділювачі шляху — 404", async () => {
    for (const p of [
      "/uk/blog/..%2f..%2f..%2fpackage",
      "/uk/blog/..%252f..%252fpackage",
      "/uk/blog/%2e%2e%2f%2e%2e%2fpackage",
    ]) {
      const res = await fetch(`${BASE}${p}`);
      expect(res.status, p).toBe(404);
    }
  });

  it("контроль: справжня стаття відповідає 200", async () => {
    // Без контролю тест був би зелений і тоді, коли блог зламаний цілком.
    expect((await fetch(`${BASE}/uk/blog/sejm-1991`)).status).toBe(200);
  });
});

describe("open redirect", () => {
  it("редиректи proxy.js лишаються на своєму хості", async () => {
    for (const p of ["//evil.example/x", "/https://evil.example", "/blog", "/kontakty"]) {
      const res = await get(p);
      expect([307, 308], p).toContain(res.status);
      const location = res.headers.get("location") || "";
      const host = new URL(location, BASE).host;
      expect(host, `${p} -> ${location}`).toBe(new URL(BASE).host);
    }
  });
});
