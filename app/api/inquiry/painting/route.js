import { NextResponse } from "next/server";
import { sendMail, escapeHtml } from "@/lib/mail";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";
import { guardInquiry } from "@/lib/formGuard";
import { getData } from "@/lib/store";
import { formatPrice } from "@/lib/price";

// Абсолютний URL відносно NEXT_PUBLIC_SITE_URL; для вже абсолютних
// (напр. Vercel Blob) повертає їх без змін. null на будь-яку сміттєву адресу.
function safeAbsoluteUrl(path) {
  if (!path) return null;
  try {
    return new URL(path, process.env.NEXT_PUBLIC_SITE_URL).toString();
  } catch {
    return null;
  }
}

const STATUSES = { available: "в наявності", sold: "продано", collection: "у приватній колекції" };

// Робота шукається в даних сайту за id, а не береться з тіла запиту:
// номер, назва, фото й розмір у листі мають бути справжніми, навіть
// якщо форму надіслали в обхід сайту.
async function resolveWork(id) {
  if (!id) return null;
  const data = await getData();
  const p = data.paintings.find((x) => x.id === id);
  if (!p) return null;
  return {
    code: p.code,
    title: p.title?.uk || p.id,
    category: "Живопис — картина",
    size: p.size ? `${p.size} см` : null,
    tech: p.tech?.uk || null,
    year: p.year || null,
    status: STATUSES[p.status] || null,
    price: p.status === "available" ? (formatPrice(p.price) || "за запитом") : null,
    img: p.img,
    // У картин немає власної сторінки — ведемо в галерею, до якоря роботи.
    page: `/uk/zhyvopys#${encodeURIComponent(p.id)}`,
  };
}

export async function POST(request) {
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

  console.log("[inquiry:painting]", JSON.stringify(data));

  const submittedAt = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });

  const work = await resolveWork(data.workId);
  // Робота не знайшлася (стара вкладка, видалена робота) — лист усе одно
  // йде, просто з тією назвою, яку бачив відвідувач.
  const title = work?.title || data.paintingTitle || data.subject || "робота";
  const imageUrl = safeAbsoluteUrl(work?.img || data.paintingImg);
  const pageUrl = safeAbsoluteUrl(work?.page || data.pageUrl);
  // Номер у темі листа — щоб Іван упізнав роботу ще зі списку пошти.
  const heading = work?.code ? `${work.code} «${title}»` : `«${title}»`;

  const rows = [
    ["Номер роботи", work?.code],
    ["Назва", title],
    ["Категорія", work?.category],
    ["Розмір", work?.size],
    ["Техніка", work?.tech],
    ["Рік", work?.year],
    ["Ціна", work?.price],
    ["Статус", work?.status],
    ["Сторінка роботи", pageUrl, "link"],
    ["Ім'я", data.name],
    ["Телефон", data.phone],
    ["Email", data.email],
    ["Повідомлення", data.comment],
    ["Час подачі", submittedAt],
    ["IP", ip],
  ].filter(([, value]) => value);

  const thumb = imageUrl
    ? `<a href="${escapeHtml(pageUrl || imageUrl)}" style="display:inline-block; text-decoration:none;">
         <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" width="220"
              style="display:block; width:220px; max-width:100%; height:auto; border:1px solid #e2ded7; border-radius:4px;" />
       </a>`
    : "";

  const html = `
    <div style="font-family: sans-serif; font-size: 14px; color: #111;">
      <h2 style="margin: 0 0 4px;">Заявка по роботі ${escapeHtml(heading)}</h2>
      <p style="margin: 0 0 16px; color: #666; font-size: 13px;">iwankulik.com</p>
      ${thumb ? `<div style="margin: 0 0 16px;">${thumb}</div>` : ""}
      <table cellpadding="4" cellspacing="0">
        ${rows
          .map(([label, value, kind]) => {
            const safeValue = escapeHtml(value);
            const cell = kind === "link" ? `<a href="${safeValue}">${safeValue}</a>` : safeValue;
            return `<tr><td style="color:#666; white-space:nowrap; vertical-align:top;"><strong>${escapeHtml(label)}</strong></td><td>${cell}</td></tr>`;
          })
          .join("")}
      </table>
      ${imageUrl ? `<p style="margin: 16px 0 0; color: #666; font-size: 12px;">Фото роботи: <a href="${escapeHtml(imageUrl)}">${escapeHtml(imageUrl)}</a></p>` : ""}
    </div>
  `.trim();

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(imageUrl ? [`Фото роботи: ${imageUrl}`] : []),
  ].join("\n");

  // sendMail сама ловить власні винятки й ніколи не кидає далі — але це не
  // означає "все добре": skipped (нема RESEND_API_KEY) і ok:false (Resend
  // відмовив) означають, що лист НЕ пішов, а заявка без сліду. Критичний
  // шлях — відповідаємо помилкою, а не мовчазним ok:true.
  const mailResult = await sendMail({
    to: process.env.MAIL_TO_INQUIRY || process.env.MAIL_TO_ADMIN,
    subject: `Заявка: ${heading}`,
    html,
    text,
    replyTo: data.email || undefined,
  });

  if (mailResult.ok !== true) {
    await logEvent({
      action: "mail_failed",
      user: data.email || null,
      ip,
      ua,
      detail: `заявка по роботі ${heading} не надійшла листом (${mailResult.skipped ? "RESEND_API_KEY не задано" : "помилка Resend"})`,
    });
    return NextResponse.json({ ok: false, error: "mail_failed" }, { status: 502 });
  }

  await logEvent({
    action: "inquiry",
    user: data.email || null,
    ip,
    ua,
    detail: `заявка по роботі ${heading}`,
  });

  return NextResponse.json({ ok: true });
}
