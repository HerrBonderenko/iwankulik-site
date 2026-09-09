// Rate limiting логіну від підбору пароля.
// Той самий Netlify Blobs store, що й у lib/store.js ("site"); у режимі
// fs (локальна розробка) — окремий JSON-файл, щоб можна було перевірити
// роботу без хмарного сховища.
import "server-only";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { readJsonFile, quarantineJsonFile, isBroken } from "@/lib/jsonFile";
import { IS_NETLIFY, getNetlifyStore } from "@/lib/store";

const KEY_PREFIX = "ratelimit/login/";
export const MAX_ATTEMPTS = 5;
const BLOCK_MS_LEVEL_1 = 15 * 60 * 1000; // 15 хв
const BLOCK_MS_LEVEL_2 = 60 * 60 * 1000; // 1 год
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // застарілий запис без блоку — скидаємо

const FS_FILE = path.join(process.cwd(), "content", "ratelimit.json");

function keyFor(ip) {
  return `${KEY_PREFIX}${ip}`;
}

// Генерична сховищна пара для лічильників rate-limit за довільним, уже
// повністю сформованим ключем (напр. "ratelimit/login/1.2.3.4" або
// "ratelimit/inquiry/1.2.3.4") — та сама Netlify Blobs / fs логіка,
// перевикористовується й поза логіном.
export async function getCounterEntry(key) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    try {
      // type: "json" робить JSON.parse усередині — недописаний блоб
      // кине SyntaxError звідси.
      return (await store.get(key, { type: "json" })) || null;
    } catch (err) {
      console.error(`[rateLimit] лічильник ${key} не читається:`, err);
      return null;
    }
  }
  // Раніше тут стояв голий catch, який ковтав і відсутній файл, і
  // побитий. Різниця важлива: побитий файл означав, що захист від
  // підбору тихо перестав працювати, і в журналі про це не було
  // ані слова. Тепер про це чути (readJsonFile пише в консоль).
  //
  // Відповідь лишається "запису нема" — тобто не блокуємо. Це свідомо:
  // зворотний варіант замкнув би вхід усім одразу, а вхід в адмінку
  // захищений ще й паролем із bcrypt.
  const { value } = await readJsonFile(FS_FILE, {});
  return value[key] || null;
}

export async function setCounterEntry(key, entry) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    if (entry) await store.setJSON(key, entry);
    else await store.delete(key);
    return;
  }
  // Тут читання — початок циклу read-modify-write, тож "не прочитався"
  // і "порожній" — різні речі: у файлі лежать лічильники інших адрес,
  // і запис поверх наосліп стер би їх усі.
  const { value: all, state } = await readJsonFile(FS_FILE, {});
  if (isBroken(state)) {
    const moved = await quarantineJsonFile(FS_FILE);
    // Відкласти не вдалося — краще пропустити цей запис, ніж затерти
    // чужі лічильники.
    if (!moved) return;
  }
  if (entry) all[key] = entry;
  else delete all[key];
  await writeJsonAtomic(FS_FILE, all);
}

function freshEntry() {
  return { failCount: 0, level: 0, blockedUntil: 0, lastFailAt: 0 };
}

function normalize(entry, now) {
  if (!entry) return freshEntry();
  if (!entry.blockedUntil && now - entry.lastFailAt > ENTRY_TTL_MS) {
    return freshEntry();
  }
  return entry;
}

// Netlify (основна платформа) → Vercel (запасна) → інше. x-forwarded-for
// може містити ланцюжок "клієнт, проксі1, проксі2" — беремо перший.
// Якщо жодного заголовка нема (продакшен без відомого проксі) — повертаємо
// null: ліпше пропустити rate-limit для цього запиту, ніж звести всіх
// відвідувачів під один спільний лічильник "local" і заблокувати одне
// одного. У розробці (немає жодного проксі-заголовка за визначенням)
// лишаємо "local" — там один відвідувач, спільний лічильник не шкодить.
export function getClientIp(request) {
  const nf = request.headers.get("x-nf-client-connection-ip");
  if (nf) return nf;
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return process.env.NODE_ENV === "production" ? null : "local";
}

// ip === null — джерело запиту невідоме, rate-limit по IP неможливий:
// не блокуємо (false), щоб не зачепити всіх відвідувачів разом.
export async function checkBlocked(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = normalize(await getCounterEntry(keyFor(ip)), now);
  return Boolean(entry.blockedUntil && now < entry.blockedUntil);
}

// Читає поточний стан лічильника без змін — для сповіщень (напр. виявити
// момент, коли recordFailure щойно призвела до нового блокування).
export async function getBlockInfo(ip) {
  if (!ip) return freshEntry();
  return normalize(await getCounterEntry(keyFor(ip)), Date.now());
}

// ip === null — не рахуємо спробу в спільний лічильник (див. checkBlocked).
export async function recordFailure(ip) {
  if (!ip) return;
  const now = Date.now();
  const entry = normalize(await getCounterEntry(keyFor(ip)), now);
  entry.failCount += 1;
  entry.lastFailAt = now;
  if (entry.failCount >= MAX_ATTEMPTS) {
    entry.level += 1;
    entry.blockedUntil = now + (entry.level >= 2 ? BLOCK_MS_LEVEL_2 : BLOCK_MS_LEVEL_1);
    entry.failCount = 0;
  }
  await setCounterEntry(keyFor(ip), entry);
}

export async function recordSuccess(ip) {
  if (!ip) return;
  await setCounterEntry(keyFor(ip), null);
}
