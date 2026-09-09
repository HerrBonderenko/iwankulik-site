import { NextResponse } from "next/server";
import { signFormTimestamp } from "@/lib/formGuard";

// Підписаний timestamp "форму відкрито зараз" — форми заявок беруть його
// при рендері й повертають разом із заявкою, щоб сервер міг відрізнити
// людину (природна пауза між відкриттям і сабмітом) від бота.
export async function GET() {
  const ts = Date.now();
  const sig = signFormTimestamp(ts);
  return NextResponse.json({ ts, sig });
}
