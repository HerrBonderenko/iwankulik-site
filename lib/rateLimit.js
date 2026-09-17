// Rate limiting логіну від підбору пароля.
// Той самий Netlify Blobs store, що й у lib/store.js ("site"); у режимі
// fs (локальна розробка) — окремий JSON-файл, щоб можна було перевірити
// роботу без хмарного сховища.
import "server-only";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { readJsonFile, quarantineJsonFile, isBroken } from "@/lib/jsonFile";
import { IS_NETLIFY, getNetlifyStore } from "@/lib/store";
import { CONTENT_DIR } from "@/lib/contentDir";

const KEY_PREFIX = "ratelimit/login/";
export const MAX_ATTEMPTS = 5;
const BLOCK_MS_LEVEL_1 = 15 * 60 * 1000; // 15 хв
const BLOCK_MS_LEVEL_2 = 60 * 60 * 1000; // 1 год
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000; // застарілий запис без блоку — скидаємо

const FS_FILE = path.join(CONTENT_DIR, "ratelimit.json");

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

// Довірений заголовок з адресою клієнта — свій на кожній платформі, і
// рівно один. Раніше заголовки перебиралися по черзі (x-nf-… →
// x-forwarded-for → x-real-ip), але заголовок, який на поточній
// платформі проксі НЕ виставляє, приходить таким, яким його прислав
// клієнт: на Vercel можна було прислати свій x-nf-client-connection-ip
// і отримувати свіжий лічильник на кожен запит — тобто зняти і
// блокування підбору пароля, і ліміт заявок (аудит, F-02).
//
// IS_NETLIFY_BUILD вшито літералом на збірці (див. next.config.mjs) —
// у рантаймі Netlify Function змінної NETLIFY вже нема. VERCEL живе
// і в рантаймі функцій Vercel; x-vercel-forwarded-for там виставляє
// сама платформа.
// Для площадки поза Netlify/Vercel (свій сервер за відомим проксі)
// заголовок задається явно змінною TRUSTED_IP_HEADER — але тільки той,
// який гарантовано виставляє САМ проксі, перетираючи присланий клієнтом.
const TRUSTED_IP_HEADER = process.env.TRUSTED_IP_HEADER
  ? process.env.TRUSTED_IP_HEADER.toLowerCase()
  : process.env.IS_NETLIFY_BUILD
    ? "x-nf-client-connection-ip"
    : process.env.VERCEL
      ? "x-vercel-forwarded-for"
      : null;

// Площадку не впізнано і заголовок не задано — захист від підбору
// пароля, ліміт заявок і IP у журналі ВИМКНЕНІ, бо адресу клієнта нема
// звідки взяти достовірно. Перевірено запуском (аудит, R-02): вісім
// невдалих входів поспіль без жодного блокування, і зовні цього не
// видно. Тому мовчати тут не можна — гучно пишемо в консоль (у логи
// функції/сервера, які власник самохоста бачить у своєму терміналі).
//
// У журнал подій це попередження навмисно НЕ пишемо: воно спрацьовує
// лише на невпізнаній площадці, тобто у fs-режимі, де logEvent із цього
// самого запиту (login_fail тощо) уже йде в той самий файл, і асинхронний
// запис-попередження змагався б із ним за read-modify-write (гонка з
// atomicWrite.js). Консоль надійніша й адресована тому самому власнику.
let reportedNoTrustedHeader = false;

function reportNoTrustedHeader() {
  // Раз на інстанс процесу, а не на кожен запит: у serverless процеси
  // перезапускаються самі, тож попередження однаково повторюватиметься.
  if (reportedNoTrustedHeader) return;
  reportedNoTrustedHeader = true;
  console.error(
    "[rateLimit] Площадку не впізнано (ні Netlify, ні Vercel) і TRUSTED_IP_HEADER не задано: " +
      "захист від підбору пароля, ліміт заявок та IP у журналі ВИМКНЕНІ. " +
      "Задайте TRUSTED_IP_HEADER заголовком, який виставляє ваш проксі."
  );
}

// null — джерело невідоме (платформа без відомого проксі або заголовок
// не прийшов): ліпше пропустити rate-limit для цього запиту, ніж
// рахувати підроблені адреси чи звести всіх відвідувачів під один
// спільний лічильник і заблокувати одне одного. У розробці лишаємо
// "local" — там один відвідувач, спільний лічильник не шкодить.
export function getClientIp(request) {
  if (process.env.NODE_ENV !== "production") return "local";
  if (!TRUSTED_IP_HEADER) {
    reportNoTrustedHeader();
    return null;
  }
  const value = request.headers.get(TRUSTED_IP_HEADER);
  if (!value) return null;
  // Про всяк випадок: якщо значення виявиться ланцюжком, беремо перший
  // елемент — платформа пише туди адресу клієнта.
  const first = value.split(",")[0].trim();
  return first || null;
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
