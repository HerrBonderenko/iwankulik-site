// Єдина точка відправки email через Resend.
import "server-only";
import { Resend } from "resend";

// Reply-To листа заявки — адреса відвідувача з форми: відповідь із пошти
// йде йому, а не на службовий MAIL_FROM. У заголовок пускаємо рівно один
// валідний email і нічого більше: ні display-name ("Ivan <a@b.co>"), ні
// списку через кому, ні пробілів/переносів рядка.
const REPLY_TO_RE = /^[^\s@,;:<>"\\]+@[^\s@,;:<>"\\]+\.[^\s@,;:<>"\\]+$/;
// \s не покриває решту керуючих символів — перевіряємо їх окремо.
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

// Валідний email або undefined. Тихо відкидаємо все інше — краще лист
// без Reply-To, ніж із чужим значенням у заголовку.
export function sanitizeReplyTo(value) {
  if (typeof value !== "string") return undefined;
  const email = value.trim();
  if (!email || email.length > 200) return undefined;
  if (CONTROL_RE.test(email) || !REPLY_TO_RE.test(email)) return undefined;
  return email;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[mail] RESEND_API_KEY не задано, лист не надіслано: "${subject}"`);
    return { skipped: true };
  }
  // Санітизація саме тут, а не в роутах: mail.js — єдина точка відправки,
  // тож жоден виклик не може пронести в заголовок сире значення з форми.
  const safeReplyTo = sanitizeReplyTo(replyTo);
  if (replyTo && !safeReplyTo) {
    console.warn(`[mail] replyTo відкинуто як невалідний, лист піде без нього: "${subject}"`);
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text,
      ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
    });
    if (error) {
      console.error("[mail] Resend повернув помилку:", error);
      return { ok: false, error };
    }
    return { ok: true, data };
  } catch (error) {
    console.error("[mail] Не вдалося надіслати лист:", error);
    return { ok: false, error };
  }
}

// Захист від HTML-ін'єкції при вставці даних відвідувача в лист.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
