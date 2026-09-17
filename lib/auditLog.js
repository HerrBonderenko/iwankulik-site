// Аудит-лог дій в адмінці. Той самий Netlify Blobs store, що й lib/store.js
// та lib/rateLimit.js; у fs-режимі — окремий файл на кожен місяць.
import "server-only";
import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { readJsonFile, quarantineJsonFile, isBroken } from "@/lib/jsonFile";
import { IS_NETLIFY, getNetlifyStore } from "@/lib/store";
import { CONTENT_DIR } from "@/lib/contentDir";

const KEY_PREFIX = "logs/";
const MAX_ENTRIES_PER_MONTH = 5000;
const FS_DIR = path.join(CONTENT_DIR, "logs");

// save_rejected — дані не пройшли перевірку (винен запит).
// save_failed — дані валідні, але сховище їх не прийняло (винен не запит).
// storage_error — не вдалося прочитати сховище під час рендера.
export const ACTIONS = ["login_ok", "login_fail", "logout", "upload", "delete", "edit", "save_rejected", "save_failed", "inquiry", "spam_blocked", "mail_failed", "storage_error"];

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

function fsPath(month) {
  return path.join(FS_DIR, `${month}.json`);
}

// Повертає і список, і стан читання: тому, хто збирається дописувати,
// треба знати, що файл непридатний, — інакше він затре історію.
async function readMonth(month) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    try {
      return { list: (await store.get(`${KEY_PREFIX}${month}`, { type: "json" })) || [], state: "ok" };
    } catch (err) {
      console.error(`[auditLog] Журнал за ${month} не читається:`, err);
      return { list: [], state: "corrupt" };
    }
  }
  const { value, state } = await readJsonFile(fsPath(month), []);
  // Файл є, читається, але всередині не масив — далі list.push впав би.
  if (state === "ok" && !Array.isArray(value)) {
    console.error(`[auditLog] Журнал за ${month} містить не масив`);
    return { list: [], state: "corrupt" };
  }
  return { list: value, state };
}

async function writeMonth(month, list) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    await store.setJSON(`${KEY_PREFIX}${month}`, list);
    return;
  }
  // Той самий приймач, що й для даних сайту: сторінка /admin/logs читає
  // цей файл, і читання могло припасти рівно на запис події.
  await writeJsonAtomic(fsPath(month), list);
}

// Значення приходять і з публічних запитів (логін зі спроби входу,
// email заявника ще до перевірки довжини) і осідають у сховищі
// назавжди, а logEvent на кожну подію читає й переписує місячний блоб
// цілком. Ріжемо тут, у єдиній точці запису, — так наступний тип події
// буде обмежений автоматично (аудит, F-04). Ліміти з запасом: найдовший
// справжній detail — перелік видалених робіт, user — email до 200.
const cap = (value, max) => (value ? String(value).slice(0, max) : null);

// Помилка запису в лог не повинна ламати дію, яку логуємо.
export async function logEvent({ action, user, ip, ua, detail }) {
  try {
    const now = new Date();
    const month = monthKey(now);
    const { list, state } = await readMonth(month);
    // Побитий файл журналу раніше означав, що до кінця місяця не
    // запишеться жодна подія: readMonth кидав виняток, зовнішній catch
    // його ковтав, і так на кожен виклик. Тепер файл відкладається
    // вбік — історія лишається на диску для розбору, а журнал знову
    // починає працювати з наступної ж події.
    if (isBroken(state)) {
      const moved = await quarantineJsonFile(fsPath(month));
      if (!moved) return;
    }
    if (list.length >= MAX_ENTRIES_PER_MONTH) {
      console.warn(`[auditLog] Ліміт ${MAX_ENTRIES_PER_MONTH} записів за ${month} досягнуто — подію "${action}" пропущено`);
      return;
    }
    list.push({
      ts: now.toISOString(),
      action,
      user: cap(user, 200),
      ip: cap(ip, 64),
      // 256 символів вистачає на будь-який справжній браузер.
      ua: cap(ua, 256),
      detail: cap(detail, 500),
    });
    await writeMonth(month, list);
  } catch (err) {
    console.error("[auditLog] Не вдалося записати подію:", err);
  }
}

export async function readLogs({ month, action } = {}) {
  try {
    const m = month || monthKey();
    // Читання зі сторінки /admin/logs нічого у файловій системі не рухає:
    // побитий файл відкладе перший же logEvent, а не показ журналу.
    const { list } = await readMonth(m);
    const filtered = action ? list.filter((e) => e.action === action) : list;
    return filtered.slice().reverse(); // новіші зверху
  } catch (err) {
    console.error("[auditLog] Не вдалося прочитати лог:", err);
    return [];
  }
}

// Список місяців, за які є записи (для фільтра), новіші зверху.
// Поточний місяць завжди присутній, навіть якщо ще порожній.
export async function listMonths() {
  const current = monthKey();
  try {
    let months;
    if (IS_NETLIFY) {
      const store = await getNetlifyStore();
      const { blobs } = await store.list({ prefix: KEY_PREFIX });
      months = blobs.map((b) => b.key.slice(KEY_PREFIX.length));
    } else {
      const files = await fs.readdir(FS_DIR).catch(() => []);
      months = files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    }
    const set = new Set([current, ...months]);
    return Array.from(set).sort().reverse();
  } catch (err) {
    console.error("[auditLog] Не вдалося отримати список місяців:", err);
    return [current];
  }
}
