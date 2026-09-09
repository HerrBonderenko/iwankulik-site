// Роздача завантажених фото у файловому режимі та з Netlify Blobs.
// На Vercel фото живуть у Blob з абсолютними адресами і сюди не потрапляють.
import fs from "fs/promises";
import path from "path";
import { getUploadedImage, IS_NETLIFY } from "@/lib/store";

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_req, { params }) {
  const { file } = await params;
  const safe = path.basename(file); // відсікаємо будь-які ../
  const type = TYPES[path.extname(safe).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 }); // напр. службовий meta.json у fs-режимі
  try {
    if (IS_NETLIFY) {
      const buf = await getUploadedImage(safe);
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    const full = path.join(process.cwd(), "content", "uploads", safe);
    const buf = await fs.readFile(full);
    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
