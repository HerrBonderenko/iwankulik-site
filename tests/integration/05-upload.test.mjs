// Завантаження файлів: тип за magic bytes, пересборка через sharp,
// санітизація імені, віддача без traversal.
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BASE, CONTENT, login } from "./helpers.mjs";

let cookie;
beforeAll(async () => {
  cookie = await login();
});

function uploadFile(bytes, filename, type) {
  const form = new FormData();
  form.append("file", new File([bytes], filename, { type }));
  return fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie }, body: form });
}

describe("перевірка вмісту", () => {
  it("текст під іменем .png і з підробленим Content-Type — 400", async () => {
    const res = await uploadFile(Buffer.from("це текст, а не картинка <b>audit-marker</b>"), "fake.png", "image/png");
    expect(res.status).toBe(400);
  });

  it("SVG зі скриптом — 400 (SVG не приймається взагалі)", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>`;
    const res = await uploadFile(Buffer.from(svg), "img.svg", "image/svg+xml");
    expect(res.status).toBe(400);
  });
});

describe("імʼя файлу", () => {
  it("traversal в імені знешкоджується, файл лягає всередину uploads", async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .png()
      .toBuffer();
    const res = await uploadFile(png, "../../../etc/passwd.png", "image/png");
    expect(res.status).toBe(200);
    const { url } = await res.json();
    // У самому URL після /uploads/ не лишилося розділювачів шляху.
    expect(url).toMatch(/^\/uploads\/[^/]+$/);
    // А на диску файл — усередині теки uploads тимчасового сховища.
    const files = readdirSync(path.join(CONTENT, "uploads"));
    expect(files.some((f) => url.endsWith(f))).toBe(true);
    // І він пересібраний у WebP (не вихідні байти).
    expect(url.endsWith(".webp")).toBe(true);
  });
});

describe("віддача завантаженого", () => {
  it("traversal у маршруті /uploads — 404", async () => {
    expect((await fetch(`${BASE}/uploads/..%2f..%2fpackage.json`)).status).toBe(404);
    expect((await fetch(`${BASE}/uploads/....%2f%2fpackage.json`)).status).toBe(404);
  });

  it("службовий meta.json не віддається (whitelist розширень)", async () => {
    expect((await fetch(`${BASE}/uploads/meta.json`)).status).toBe(404);
  });
});
