// Спільні помічники інтеграційних тестів. Сервери піднімає
// tests/setup/global.mjs; адреси й теки приходять через inject().
import { inject } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const BASE = inject("baseUrl");
export const BARE = inject("bareUrl");
export const CONTENT = inject("contentDir");
export const BARE_CONTENT = inject("bareContentDir");
export const BARE_LOG = inject("bareLogFile");
export const PASSWORD = inject("adminPassword");

// Кожному тесту — свій IP, щоб лічильники лімітів не чіпали сусідні
// тести. 203.0.113.0/24 — документаційний діапазон (TEST-NET-3).
let ipCounter = 0;
export function uniqueIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

export function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// Вхід в адмінку; повертає рядок Cookie для наступних запитів.
export async function login(ip = uniqueIp()) {
  const res = await postJson(`${BASE}/api/admin/login`, { login: "audit", password: PASSWORD }, { "x-vercel-forwarded-for": ip });
  if (res.status !== 200) throw new Error(`login: HTTP ${res.status}`);
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/of_admin_session=[^;]+/);
  if (!m) throw new Error("login: cookie не видано");
  return m[0];
}

// Токен форми + пауза, більша за мінімальні 3 секунди, — «людська» заявка.
export async function formToken(ip) {
  const res = await fetch(`${BASE}/api/form-token`, { headers: { "x-vercel-forwarded-for": ip } });
  return res.json();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Журнал подій сервера — прямо з файлового сховища. Спам-фільтр
// навмисно відповідає 200 {ok:true} і на блокування, і на прийом, тож
// перевіряти НАСЛІДОК можна тільки тут, а не за кодом відповіді.
export function readAuditLog(contentDir = CONTENT) {
  const dir = path.join(contentDir, "logs");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files.flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
}

// Дочекатися появи запису в журналі (запис асинхронний щодо відповіді).
export async function waitForLog(predicate, { contentDir = CONTENT, timeoutMs = 5000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const hit = readAuditLog(contentDir).find(predicate);
    if (hit) return hit;
    await sleep(200);
  }
  return null;
}
