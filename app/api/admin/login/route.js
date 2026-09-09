import { NextResponse } from "next/server";
import { verifyCredentials, getSession } from "@/lib/adminAuth";
import { getClientIp, checkBlocked, recordFailure, recordSuccess, getBlockInfo, MAX_ATTEMPTS } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";
import { checkAndRememberDevice } from "@/lib/deviceTracking";
import { sendMail, escapeHtml } from "@/lib/mail";

const FAIL_DELAY_MS = 1000;

function kyivTime(date = new Date()) {
  return date.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return minutes % 60 === 0 ? `${minutes / 60} год` : `${minutes} хв`;
}

export async function POST(request) {
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "";

  if (await checkBlocked(ip)) {
    return NextResponse.json(
      { ok: false, error: "Забагато спроб. Спробуйте пізніше." },
      { status: 429 }
    );
  }

  const { login, password } = await request.json().catch(() => ({}));
  const user = await verifyCredentials(login, password);

  if (!user) {
    // Стан лічильника до/після — щоб надіслати лист лише в момент,
    // коли ця спроба щойно ввімкнула блокування (не на кожну наступну).
    let before = null;
    try {
      before = await getBlockInfo(ip);
    } catch (err) {
      console.error("[login] Не вдалося прочитати стан rate-limit:", err);
    }

    await recordFailure(ip);
    await logEvent({
      action: "login_fail",
      user: login || null,
      ip,
      ua,
      detail: `спроба входу як "${login || ""}"`,
    });

    try {
      const after = await getBlockInfo(ip);
      const justBlocked = Boolean(after.blockedUntil) && after.blockedUntil !== before?.blockedUntil;
      if (justBlocked) {
        const durationMs = after.blockedUntil - Date.now();
        const time = kyivTime();
        await sendMail({
          to: process.env.MAIL_TO_ADMIN,
          subject: "Заблоковано підбір пароля до адмінки",
          html: `
            <div style="font-family: sans-serif; font-size: 14px; color: #111;">
              <h2 style="margin: 0 0 16px;">Заблоковано підбір пароля до адмінки</h2>
              <table cellpadding="4" cellspacing="0">
                <tr><td><strong>IP</strong></td><td>${escapeHtml(ip)}</td></tr>
                <tr><td><strong>Кількість спроб</strong></td><td>${escapeHtml(MAX_ATTEMPTS)}</td></tr>
                <tr><td><strong>Тривалість блокування</strong></td><td>${escapeHtml(formatDurationMs(durationMs))}</td></tr>
                <tr><td><strong>Останній використаний логін</strong></td><td>${escapeHtml(login || "(не вказано)")}</td></tr>
                <tr><td><strong>Час</strong></td><td>${escapeHtml(time)}</td></tr>
              </table>
            </div>
          `.trim(),
          text: [
            `IP: ${ip}`,
            `Кількість спроб: ${MAX_ATTEMPTS}`,
            `Тривалість блокування: ${formatDurationMs(durationMs)}`,
            `Останній використаний логін: ${login || "(не вказано)"}`,
            `Час: ${time}`,
          ].join("\n"),
        });
      }
    } catch (err) {
      console.error("[login] Не вдалося перевірити/надіслати сповіщення про блокування:", err);
    }

    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return NextResponse.json(
      { ok: false, error: "Невірний логін або пароль" },
      { status: 401 }
    );
  }

  await recordSuccess(ip);

  // Ротація сесії: знищуємо попередню (якщо була) перед видачею нової.
  const session = await getSession();
  session.destroy();
  session.login = user.login;
  session.name = user.name;
  await session.save();

  await logEvent({ action: "login_ok", user: user.login, ip, ua, detail: null });

  try {
    const isNewDevice = await checkAndRememberDevice(user.login, ip, ua);
    if (isNewDevice) {
      const time = kyivTime();
      await sendMail({
        to: process.env.MAIL_TO_ADMIN,
        subject: "Вхід в адмінку з нового пристрою",
        html: `
          <div style="font-family: sans-serif; font-size: 14px; color: #111;">
            <h2 style="margin: 0 0 16px;">Вхід в адмінку з нового пристрою</h2>
            <table cellpadding="4" cellspacing="0">
              <tr><td><strong>Логін</strong></td><td>${escapeHtml(user.login)}</td></tr>
              <tr><td><strong>Ім'я</strong></td><td>${escapeHtml(user.name)}</td></tr>
              <tr><td><strong>Час</strong></td><td>${escapeHtml(time)}</td></tr>
              <tr><td><strong>IP</strong></td><td>${escapeHtml(ip)}</td></tr>
              <tr><td><strong>User-Agent</strong></td><td>${escapeHtml(ua)}</td></tr>
            </table>
          </div>
        `.trim(),
        text: [
          `Логін: ${user.login}`,
          `Ім'я: ${user.name}`,
          `Час: ${time}`,
          `IP: ${ip}`,
          `User-Agent: ${ua}`,
        ].join("\n"),
      });
    }
  } catch (err) {
    console.error("[login] Не вдалося перевірити пристрій/надіслати сповіщення:", err);
  }

  return NextResponse.json({ ok: true });
}
