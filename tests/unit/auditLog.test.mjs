// lib/auditLog.js: обрізання значень на єдиній точці запису журналу.
// Падає, якщо прибрати cap() — тобто якщо журнал знову почне приймати
// нескінченні значення з публічних запитів (аудит, F-04).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let logEvent, readLogs, tmp;

beforeAll(async () => {
  // CONTENT_DIR читається при завантаженні модуля — задаємо до імпорту.
  tmp = mkdtempSync(path.join(os.tmpdir(), "iwankulik-auditlog-"));
  process.env.CONTENT_DIR = tmp;
  ({ logEvent, readLogs } = await import("@/lib/auditLog"));
});

afterAll(() => {
  delete process.env.CONTENT_DIR;
  rmSync(tmp, { recursive: true, force: true });
});

describe("logEvent", () => {
  it("обрізає detail/user/ua до лімітів", async () => {
    await logEvent({
      action: "login_fail",
      user: "u".repeat(100_000),
      ip: "203.0.113.1",
      ua: "a".repeat(100_000),
      detail: "d".repeat(100_000),
    });
    const [entry] = await readLogs({});
    expect(entry.user.length).toBe(200);
    expect(entry.ua.length).toBe(256);
    expect(entry.detail.length).toBe(500);
  });

  it("порожні значення пише як null, не падає", async () => {
    await logEvent({ action: "logout", user: null, ip: null, ua: "", detail: undefined });
    const [entry] = await readLogs({ action: "logout" });
    expect(entry.user).toBeNull();
    expect(entry.detail).toBeNull();
  });
});
