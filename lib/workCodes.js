// Постійний номер роботи: літера виду + три цифри — К-014 (картина).
// Короткий, щоб продиктувати телефоном.
//
// Номер прив'язаний до роботи назавжди: не залежить від позиції в списку,
// від категорії, від slug/id і від редагувань. Лічильники живуть у тих
// самих даних сайту (data.counters) і тільки зростають — видалена робота
// свій номер не звільняє.

// Літера рахується від виду роботи — картини нумеруються наскрізно,
// незалежно від порядку в списку.
export const CODE_PREFIX = { paintings: "К" };
const KINDS = Object.keys(CODE_PREFIX);
const ID_KEY = { paintings: "id" };

export function formatCode(kind, n) {
  return `${CODE_PREFIX[kind]}-${String(n).padStart(3, "0")}`;
}

// Числова частина коду свого виду; null на чужий або зіпсований код.
function parseCode(kind, code) {
  if (typeof code !== "string") return null;
  const m = code.match(/^(.+?)-(\d+)$/);
  if (!m || m[1] !== CODE_PREFIX[kind]) return null;
  const n = Number(m[2]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Присвоює номери роботам, які їх ще не мають, у поточному порядку списку.
// Ідемпотентна й детермінована: повторний виклик на тих самих даних нічого
// не змінює, а два паралельні читання дають однаковий результат — тому
// безпечно викликати і на читанні (lib/store.js), і на записі.
export function assignCodes(data) {
  const counters = { ...(data.counters || {}) };

  for (const kind of KINDS) {
    const list = data[kind];
    if (!Array.isArray(list)) continue;

    // Лічильник ніколи не опускається нижче вже виданих номерів.
    let counter = Number.isInteger(counters[kind]) ? counters[kind] : 0;
    for (const item of list) {
      const n = parseCode(kind, item?.code);
      if (n && n > counter) counter = n;
    }

    const taken = new Set();
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const n = parseCode(kind, item.code);
      // Дублікат (напр. робота скопійована разом із кодом) — видаємо новий,
      // номер лишається за тим, хто в списку перший.
      if (n && !taken.has(n)) {
        taken.add(n);
        continue;
      }
      counter += 1;
      item.code = formatCode(kind, counter);
      taken.add(counter);
    }

    counters[kind] = counter;
  }

  data.counters = counters;
  return data;
}

// Закріплення номерів при збереженні з адмінки: те, що прислав клієнт,
// значення не має — код береться з попередньої збереженої версії за
// slug/id. Новим роботам номер видасть assignCodes.
export function preserveCodes(before, next) {
  for (const kind of KINDS) {
    if (!Array.isArray(next[kind])) continue;
    const key = ID_KEY[kind];
    const known = new Map();
    for (const item of before?.[kind] || []) {
      if (item?.[key] && item.code) known.set(item[key], item.code);
    }
    for (const item of next[kind]) {
      if (!item || typeof item !== "object") continue;
      const old = known.get(item[key]);
      // Довіряємо тільки збереженому раніше коду. Код, якого не було в
      // попередній версії, стирається — інакше нова робота, яка стає
      // першою в списку, могла б "перехопити" чужий номер.
      if (old) item.code = old;
      else delete item.code;
    }
  }
  // Лічильник теж не дозволяємо опустити: беремо більший із двох.
  const counters = { ...(next.counters || {}) };
  for (const kind of KINDS) {
    const prev = before?.counters?.[kind];
    if (Number.isInteger(prev) && !(counters[kind] >= prev)) counters[kind] = prev;
  }
  next.counters = counters;
  return assignCodes(next);
}

// Плоский список усіх робіт для пошуку за номером на публічній частині:
// { code, kind, key } — key це id картини.
export function buildWorkIndex({ paintings }) {
  return (paintings || [])
    .map((p) => ({ code: p.code, kind: "paintings", key: p.id }))
    .filter((w) => w.code && w.key);
}

// Латинська K читається як К: номер часто набирають, не перемкнувши
// розкладку, а «К» і «K» на вигляд не відрізняються взагалі.
const KIND_BY_LETTER = { "К": "paintings", K: "paintings" };

// Те, що людина ввела з голосу чи з паперу, — у канонічний код:
// "к1", "K-1", "к 001", "К—1" → "К-001". null, якщо на номер не схоже.
export function normalizeCode(raw) {
  const m = String(raw ?? "").trim().toUpperCase().match(/^([^\s\d-])\s*[-–—.]?\s*0*(\d{1,6})$/);
  if (!m) return null;
  const kind = KIND_BY_LETTER[m[1]];
  const n = Number(m[2]);
  if (!kind || !n) return null;
  return formatCode(kind, n);
}
