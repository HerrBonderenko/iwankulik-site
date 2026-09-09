import { NextResponse } from "next/server";
import { getSession } from "@/lib/adminAuth";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";

export async function POST(request) {
  const session = await getSession();
  const user = session.login || null;
  session.destroy();

  await logEvent({
    action: "logout",
    user,
    ip: getClientIp(request),
    ua: request.headers.get("user-agent") || "",
    detail: null,
  });

  return NextResponse.json({ ok: true });
}
