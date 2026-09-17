import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
// Те саме сховище лічильників, що й у лімітів: іншого серверного стану
// в проєкті немає, а для відкликання сесій потрібен саме він (див. нижче).
import { getCounterEntry, setCounterEntry } from "@/lib/rateLimit";

const COOKIE = "of_admin_session";

const sessionOptions = {
  cookieName: COOKIE,
  password: process.env.SESSION_SECRET || "",
  ttl: 60 * 60 * 24 * 7, // 7 днів
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession(await cookies(), sessionOptions);
}

// Другий рубіж до SameSite=Lax для мутуючих admin-запитів: Chrome ще
// відправляє свіжу (до двох хвилин після видачі) cookie з міжсайтовим
// POST — поведінка "Lax+allowing-unsafe" (аудит, F-10). Запит без
// Origin — не браузерний (curl, власні скрипти), його пропускаємо:
// cookie він усе одно не має.
//
// Порівнюємо хост Origin із хостом, НА ЯКИЙ РЕАЛЬНО ПРИЙШОВ ЗАПИТ, а не з
// new URL(request.url).host: Next нормалізує request.url, і на 127.0.0.1
// його хост ставав "localhost" — тобто запит зі збіжним Origin відхилявся
// (403), а з розбіжним проходив. Помічено тестом (аудит, R-06). Для
// справжнього браузерного крос-сайту Origin і Host виставляє сам браузер
// і підмінити їх на чужому боці не можна, тож це канонічна перевірка.
// За проксі оригінальний домен приходить у x-forwarded-host.
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ? forwardedHost.split(",")[0].trim() : request.headers.get("host")) || "";
  if (host && originHost === host) return true;
  // Запасний якір — налаштований домен сайту (напр. коли проксі не
  // передає Host). Приймає лише свій домен, тож CSRF не послаблює.
  try {
    const siteHost = process.env.NEXT_PUBLIC_SITE_URL && new URL(process.env.NEXT_PUBLIC_SITE_URL).host;
    if (siteHost && originHost === siteHost) return true;
  } catch {}
  return false;
}

// Відкликання сесій.
//
// iron-session тримає сесію цілком у cookie: серверного запису про неї
// немає. Тому session.destroy() на виході лише просить браузер стерти
// свою копію — а саме значення cookie лишається криптографічно чинним до
// кінця ttl. Перевірено запуском: після виходу та сама cookie й далі
// давала 200 на /api/admin/data (аудит, R-01).
//
// Лагодимо мінімальним серверним станом: на кожного користувача
// зберігаємо момент останнього виходу, а сесія носить час своєї видачі.
// Видана раніше за останній вихід — недійсна.
const epochKey = (login) => `session-epoch/${login}`;

// Викликається на виході: всі раніше видані сесії цього логіна стають
// недійсними одразу.
export async function revokeSessions(login) {
  if (!login) return;
  await setCounterEntry(epochKey(login), { since: Date.now() });
}

// Сесія без issuedAt — видана до появи цієї перевірки. Поки користувач
// жодного разу не виходив, запису епохи немає і така сесія працює як
// раніше; перший же вихід її відкликає. Так оновлення нікого не
// викидає з адмінки посеред роботи.
//
// Якщо сховище не відповідає, getCounterEntry сам повертає null — тобто
// доступ лишається. Це свідомо: замкнути вхід на час збою сховища гірше,
// ніж на той самий час лишити чинною вже вкрадену cookie, а сам збій
// однаково видно в журналі (storage_error).
async function isSessionRevoked(session) {
  if (!session?.login) return true;
  const epoch = await getCounterEntry(epochKey(session.login));
  if (!epoch?.since) return false;
  return (session.issuedAt || 0) < epoch.since;
}

// Єдина точка перевірки доступу до адмінки: повертає { login, name }
// або null. Усі обробники й сторінки мають ходити сюди, а не читати
// session.login напряму — інакше відкликання їх не зачепить.
export async function requireAdmin() {
  const session = await getSession();
  if (await isSessionRevoked(session)) return null;
  return { login: session.login, name: session.name };
}

export async function isAuthed() {
  return Boolean(await requireAdmin());
}

function parseUsers() {
  try {
    const list = JSON.parse(process.env.ADMIN_USERS || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Порівняння логіна константним за часом способом: буфери
// доповнюються до однакової довжини, бо timingSafeEqual кидає
// виняток на буферах різної довжини.
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  const len = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.alloc(len);
  const paddedB = Buffer.alloc(len);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return bufA.length === bufB.length && timingSafeEqual(paddedA, paddedB);
}

// Фіктивний bcrypt-хеш (cost 12): коли логін не знайдено, все одно
// виконуємо compare з ним, щоб час відповіді не виказував,
// існує акаунт чи ні.
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8i6vHOWXR5aOtYIWjJZZjqXwtRxGyG";

export async function verifyCredentials(login, password) {
  const users = parseUsers();
  let matched = null;
  for (const u of users) {
    if (timingSafeStringEqual(u.login, login)) matched = u;
  }
  const hash = matched?.hash || DUMMY_HASH;
  const ok = await bcrypt.compare(String(password ?? ""), hash);
  if (!matched || !ok) return null;
  return { login: matched.login, name: matched.name };
}
