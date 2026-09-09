import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

export const COOKIE = "of_admin_session";

export const sessionOptions = {
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

export async function isAuthed() {
  const session = await getSession();
  return Boolean(session.login);
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
