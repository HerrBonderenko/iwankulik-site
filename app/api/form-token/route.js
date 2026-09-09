import { NextResponse } from "next/server";
import { createFormToken } from "@/lib/formGuard";

// Підписаний timestamp "форму відкрито зараз" — форми заявок беруть його
// при рендері й повертають разом із заявкою, щоб сервер міг відрізнити
// людину (природна пауза між відкриттям і сабмітом) від бота.
export async function GET() {
  // Разом із ts і підписом віддаємо nonce: сервер погасить його після
  // першої вдалої заявки, тож повторно тим самим токеном не відправити.
  return NextResponse.json(createFormToken());
}
