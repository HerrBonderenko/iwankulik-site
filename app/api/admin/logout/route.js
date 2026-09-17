import { NextResponse } from "next/server";
import { getSession, isSameOrigin, revokeSessions } from "@/lib/adminAuth";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";

export async function POST(request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });

  const session = await getSession();
  const user = session.login || null;
  // destroy() стирає лише копію cookie в браузері; саме значення
  // лишається чинним до кінця ttl. Відкликаємо всі видані сесії
  // логіна серверним записом — див. revokeSessions (R-01).
  session.destroy();
  await revokeSessions(user);

  await logEvent({
    action: "logout",
    user,
    ip: getClientIp(request),
    ua: request.headers.get("user-agent") || "",
    detail: null,
  });

  return NextResponse.json({ ok: true });
}
