// Захист публічних форм заявок від ботів: honeypot, підписаний
// timestamp відкриття форми, ліміт заявок з IP, валідація полів.
// Лічильник заявок перевикористовує generic-сховище з lib/rateLimit.js
// (той самий Netlify Blobs/fs механізм, що й для логіну) — логіку
// логіну тут не займаємо, лише читаємо/пишемо під іншим ключем.
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getCounterEntry, setCounterEntry } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";

const SECRET = process.env.SESSION_SECRET || "";
const MIN_ELAPSED_MS = 3 * 1000; // 3 с
const MAX_ELAPSED_MS = 2 * 60 * 60 * 1000; // 2 год

const INQUIRY_LIMIT = 6;
const INQUIRY_WINDOW_MS = 60 * 60 * 1000; // 1 год

const LENGTH_LIMITS = { name: 100, email: 200, phone: 50, comment: 2000, city: 100, area: 100, size: 100, plot: 500 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\s+\-()]*$/;

// Найдовше валідне тіло заявки — це 2000 символів коментаря плюс решта
// полів; 64 КБ лишає запас навіть на кирилицю в UTF-8 і на службові поля.
export const MAX_BODY_BYTES = 64 * 1024;

// Розмір тіла перевіряємо ДО request.json(): інакше багатомегабайтний
// запит спершу цілком осідає в пам'яті функції, потрапляє в лог і лише
// потім відхиляється за довжиною полів. Повертає готову відповідь або
// null, якщо тіло прийнятне.
//
// Заголовка може не бути зовсім (chunked-передача) — тоді пропускаємо
// далі: там запит зустрічають перевірки довжини полів.
export function checkBodySize(request) {
  const header = request.headers.get("content-length");
  if (!header) return null;
  const size = Number(header);
  if (!Number.isFinite(size) || size <= MAX_BODY_BYTES) return null;
  return { blocked: true, status: 413, body: { ok: false, error: "payload_too_large" } };
}

// Токен форми: час відкриття + випадковий nonce, і те й те під підписом.
// Nonce потрібен, щоб токен був одноразовим: без нього бот брав один
// токен, витримував три секунди й слав ним заявки всі дві години життя
// підпису — перевірено, шість заявок одним токеном проходили поспіль.
export function signFormToken(ts, nonce) {
  return createHmac("sha256", SECRET).update(`${ts}.${nonce}`).digest("hex");
}

export function createFormToken() {
  const ts = Date.now();
  const nonce = randomBytes(16).toString("hex");
  return { ts, nonce, sig: signFormToken(ts, nonce) };
}

// Підпис лише за timestamp — формат до появи nonce. Лишається тільки для
// перевірки: /api/form-token таких підписів більше не видає, тож новий
// такий токен нізвідки взяти. Потрібен, щоб відвідувачі зі старим
// закешованим бандлом не втратили свою заявку в перші години після
// деплою. Через добу цю функцію і гілку в checkFormTiming можна прибрати.
export function signFormTimestamp(ts) {
  return createHmac("sha256", SECRET).update(String(ts)).digest("hex");
}

// Використані nonce лежать у тому самому лічильниковому сховищі, що й
// ліміти. Свого TTL у нього немає, тож зберігаємо час використання й
// вважаємо запис протухлим так само, як протухає сам токен.
const NONCE_TTL_MS = MAX_ELAPSED_MS;
const nonceKey = (nonce) => `formnonce/${nonce}`;

export async function isNonceUsed(nonce) {
  const entry = await getCounterEntry(nonceKey(nonce));
  if (!entry?.usedAt) return false;
  return Date.now() - entry.usedAt < NONCE_TTL_MS;
}

export async function markNonceUsed(nonce) {
  await setCounterEntry(nonceKey(nonce), { usedAt: Date.now() });
}

// null — валідний і своєчасний токен; інакше причина.
function checkFormTiming(ts, sig, nonce) {
  if (!ts || !sig) return "missing";
  const expected = nonce ? signFormToken(ts, nonce) : signFormTimestamp(ts);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid_signature";
  const elapsed = Date.now() - Number(ts);
  if (!Number.isFinite(elapsed)) return "invalid_signature";
  if (elapsed < MIN_ELAPSED_MS) return "too_fast";
  if (elapsed > MAX_ELAPSED_MS) return "too_slow";
  return null;
}

function isHoneypotTripped(data) {
  return Boolean(data.website && String(data.website).trim());
}

// "honeypot" | "timing" | null — причина для аудит-логу; відповідь
// клієнту в обох випадках однакова (поводимось як з honeypot).
export function detectSpam(data) {
  if (isHoneypotTripped(data)) return "honeypot";
  if (checkFormTiming(data.formTs, data.formSig, data.formNonce)) return "timing";
  return null;
}

// Не більше INQUIRY_LIMIT заявок з IP за INQUIRY_WINDOW_MS (ковзне вікно
// з фіксованим стартом). true — дозволено (і вже враховано в лічильнику).
// ip === null — джерело невідоме (див. getClientIp): пропускаємо перевірку
// замість того, щоб рахувати всіх таких відвідувачів в один лічильник.
export async function checkInquiryRateLimit(ip) {
  if (!ip) return true;
  const key = `ratelimit/inquiry/${ip}`;
  const now = Date.now();
  let entry = await getCounterEntry(key);
  if (!entry || now - entry.windowStart > INQUIRY_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
  }
  if (entry.count >= INQUIRY_LIMIT) return false;
  entry.count += 1;
  await setCounterEntry(key, entry);
  return true;
}

// Код помилки (для перекладу на клієнті) або null. Довжини — незалежно
// від спам-перевірок; формат email/телефону — щоб у пошту/лог не
// потрапляло сміття. Ті самі коди клієнт мапить у t.form.errors.
export function validateInquiryFields(data) {
  for (const [field, max] of Object.entries(LENGTH_LIMITS)) {
    const v = data[field];
    if (v && String(v).length > max) return "too_long";
  }
  if (data.email && !EMAIL_RE.test(String(data.email))) return "invalid_email";
  if (data.phone && !PHONE_RE.test(String(data.phone))) return "invalid_phone";
  return null;
}

// Єдина точка входу для обох форм заявок: спам-перевірки → rate limit →
// валідація полів. { blocked: true, status, body } — одразу відповісти
// цим і зупинитись; { blocked: false } — можна продовжувати обробку.
export async function guardInquiry({ data, ip, ua }) {
  const spamReason = detectSpam(data);
  if (spamReason) {
    await logEvent({ action: "spam_blocked", user: data.email || null, ip, ua, detail: spamReason });
    return { blocked: true, status: 200, body: { ok: true } };
  }

  // Підпис валідний, але цим токеном уже відправляли. Відповідь та сама,
  // що й іншим ботовим перевіркам, — щоб не підказувати, на чому спіймали.
  const nonce = data.formNonce ? String(data.formNonce) : null;
  if (nonce && (await isNonceUsed(nonce))) {
    await logEvent({ action: "spam_blocked", user: data.email || null, ip, ua, detail: "nonce_reused" });
    return { blocked: true, status: 200, body: { ok: true } };
  }

  const allowed = await checkInquiryRateLimit(ip);
  if (!allowed) {
    await logEvent({ action: "spam_blocked", user: data.email || null, ip, ua, detail: "rate_limit" });
    return {
      blocked: true,
      status: 429,
      body: { ok: false, error: "rate_limit" },
    };
  }

  const validationError = validateInquiryFields(data);
  if (validationError) {
    return { blocked: true, status: 400, body: { ok: false, error: validationError } };
  }

  // Гасимо токен лише тут, коли пройдено все. Якби гасили раніше,
  // відвідувач, який помилився в телефоні, другою спробою потрапляв би
  // у «вже використано» — і побачив би «надіслано», хоча лист не пішов.
  if (nonce) await markNonceUsed(nonce);

  return { blocked: false };
}
