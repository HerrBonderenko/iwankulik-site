// Захист публічних форм заявок від ботів: honeypot, підписаний
// timestamp відкриття форми, ліміт заявок з IP, валідація полів.
// Лічильник заявок перевикористовує generic-сховище з lib/rateLimit.js
// (той самий Netlify Blobs/fs механізм, що й для логіну) — логіку
// логіну тут не займаємо, лише читаємо/пишемо під іншим ключем.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
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

export function signFormTimestamp(ts) {
  return createHmac("sha256", SECRET).update(String(ts)).digest("hex");
}

// null — валідний і своєчасний токен; інакше причина.
function checkFormTiming(ts, sig) {
  if (!ts || !sig) return "missing";
  const expected = signFormTimestamp(ts);
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
  if (checkFormTiming(data.formTs, data.formSig)) return "timing";
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

  return { blocked: false };
}
