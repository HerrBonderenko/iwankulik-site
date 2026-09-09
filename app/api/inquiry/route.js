import { NextResponse } from "next/server";
import { sendMail, escapeHtml } from "@/lib/mail";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";
import { guardInquiry, checkBodySize } from "@/lib/formGuard";

// Тип приходить з OrderForm (value незалежний від мови сайту) — тут
// завжди мапимо в українську, бо лист читає художник.
const ORDER_TYPE_LABELS = {
  painting: "Запит по роботі",
};

export async function POST(request) {
  const oversized = checkBodySize(request);
  if (oversized) {
    return NextResponse.json(oversized.body, { status: oversized.status });
  }

  const data = await request.json().catch(() => null);
  if (!data || !data.name || !data.email) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "";

  const guard = await guardInquiry({ data, ip, ua });
  if (guard.blocked) {
    return NextResponse.json(guard.body, { status: guard.status });
  }

  // Лише відомі поля й довжина коментаря. Раніше сюди йшло ціле тіло
  // запиту: будь-яке зайве поле від анонімного відправника осідало в
  // лозі функції як є, разом із його розміром.
  console.log("[inquiry]", {
    name: data.name,
    email: data.email,
    phone: data.phone,
    commentLength: data.comment?.length ?? 0,
  });

  const submittedAt = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
  const orderTypeLabel = ORDER_TYPE_LABELS[data.orderType] || null;

  const rows = [
    ["Тип замовлення", orderTypeLabel],
    ["Тема", data.subject],
    ["Ім'я", data.name],
    ["Телефон", data.phone],
    ["Email", data.email],
    ["Повідомлення", data.comment],
    ["Час подачі", submittedAt],
    ["IP", ip],
  ].filter(([, value]) => value);

  const html = `
    <div style="font-family: sans-serif; font-size: 14px; color: #111;">
      <h2 style="margin: 0 0 16px;">Нова заявка з сайту iwankulik.com</h2>
      <table cellpadding="4" cellspacing="0">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#666; white-space:nowrap;"><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`
          )
          .join("")}
      </table>
    </div>
  `.trim();

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  // sendMail сама ловить власні винятки й ніколи не кидає далі — але це не
  // означає "все добре": skipped (нема RESEND_API_KEY) і ok:false (Resend
  // відмовив) означають, що лист НЕ пішов, а заявка без сліду. Критичний
  // шлях — відповідаємо помилкою, а не мовчазним ok:true.
  const mailResult = await sendMail({
    to: process.env.MAIL_TO_INQUIRY || process.env.MAIL_TO_ADMIN,
    subject: orderTypeLabel
      ? `Нова заявка (${orderTypeLabel}) з сайту iwankulik.com`
      : "Нова заявка з сайту iwankulik.com",
    html,
    text,
    replyTo: data.email || undefined,
  });

  const contacts = [data.phone, data.email].filter(Boolean).join(", ");

  if (mailResult.ok !== true) {
    await logEvent({
      action: "mail_failed",
      user: data.email || null,
      ip,
      ua,
      detail: `заявка від ${data.name}${contacts ? ` (${contacts})` : ""} не надійшла листом (${mailResult.skipped ? "RESEND_API_KEY не задано" : "помилка Resend"})`,
    });
    return NextResponse.json({ ok: false, error: "mail_failed" }, { status: 502 });
  }

  await logEvent({
    action: "inquiry",
    user: data.email || null,
    ip,
    ua,
    detail: `заявка від ${data.name}${contacts ? ` (${contacts})` : ""}`,
  });

  return NextResponse.json({ ok: true });
}
