import { NextResponse } from "next/server";
import sharp from "sharp";
import { saveImage } from "@/lib/store";
import { getSession } from "@/lib/adminAuth";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 МБ
const MAX_SIDE = 2500; // px

const EXT_BY_TYPE = { jpeg: ".jpg", png: ".png", webp: ".webp" };
const CONTENT_TYPE_BY_TYPE = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Тип файлу — за magic bytes на початку буфера, а не за розширенням
// імені чи Content-Type із запиту (обидва підробити відвідувачу нічого не варто).
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function POST(request) {
  const session = await getSession();
  if (!session.login) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "файл завеликий (макс. 15 МБ)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    return NextResponse.json(
      { ok: false, error: "Непідтримуваний формат файлу. Дозволені: JPEG, PNG, WebP." },
      { status: 400 }
    );
  }

  // Перезбираємо файл через sharp: декодування + повторний енкодинг
  // знищує будь-який вбудований шкідливий код і EXIF (sharp не переносить
  // метадані на вихід, якщо не викликати withMetadata()). Битий/підроблений
  // файл впаде саме тут — і не потрапить у сховище.
  // Завжди конвертуємо в WebP — він кращий за JPEG на будь-якому розмірі,
  // а поріг за розміром входу втратив сенс через клієнтське стиснення
  // (AdminApp.js уже стискає фото перед відправкою).
  const outputType = "webp";
  let outputBuffer;
  try {
    outputBuffer = await sharp(buffer)
      .rotate() // ще до втрати EXIF — фіксуємо орієнтацію з нього в самих пікселях
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.error("[upload] sharp не зміг обробити файл:", err);
    return NextResponse.json({ ok: false, error: "Не вдалося обробити зображення" }, { status: 400 });
  }

  const originalName = file.name || "photo.jpg";
  const baseName = originalName.replace(/\.[a-zA-Z0-9]+$/, "") || "photo";
  const finalFilename = `${baseName}${EXT_BY_TYPE[outputType]}`;

  const url = await saveImage(outputBuffer, finalFilename, CONTENT_TYPE_BY_TYPE[outputType], { originalName });
  const uploadedAt = new Date().toISOString();

  await logEvent({
    action: "upload",
    user: session.login,
    ip: getClientIp(request),
    ua: request.headers.get("user-agent") || "",
    detail: url,
  });

  return NextResponse.json({
    ok: true,
    url,
    uploadedBy: session.login,
    uploadedByName: session.name,
    uploadedAt,
  });
}
