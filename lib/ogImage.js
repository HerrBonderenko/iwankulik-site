// OG-картинки сторінок: один шаблон 1200×630 для всіх opengraph-image.js
// у app/(site)/[locale]/**. Сам маршрут лише збирає заголовок і фон, а
// верстка, шрифти й кодування живуть тут. Адресу картинки в og:image
// ставить сам Next — чому саме так, див. buildMetadata у lib/seo.js.
//
// Шрифти. ImageResponse (Satori) не бачить next/font і не читає ні woff2,
// ні змінні шрифти — лише статичні TTF/OTF/WOFF, передані буфером. Тому в
// lib/fonts лежать окремі статичні накреслення, зроблені зі змінних TTF
// репозиторію google/fonts (ліцензії OFL — там само):
//   fonttools varLib.instancer "CormorantGaramond[wght].ttf" wght=300
//   fonttools varLib.instancer "Archivo[wdth,wght].ttf" wdth=100 wght=500
// і підрізані fonttools subset: Cormorant — до латиниці, latin-ext і
// кирилиці (189 КБ замість 773), Archivo — до латиниці (56 КБ).
// Archivo кирилиці не має взагалі (у Google Fonts лише latin, latin-ext,
// vietnamese), тож ним набрано тільки домен — рядок, який завжди
// латиницею. Усе, що перекладається, набрано Cormorant: інакше uk і ru
// отримали б квадрати замість літер.
//
// Формат. ImageResponse віддає лише PNG, а фон тут — живопис: фотографічний
// PNG 1200×630 важить у рази більше за JPEG того самого вигляду, а
// месенджери важкі превью просто не показують. Тому PNG одразу
// перекодовуємо sharp у JPEG.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getDict, locales } from "@/lib/i18n";
import { SITE_URL, ogHeadline } from "@/lib/seo";
import { getUploadedImage, IS_NETLIFY } from "@/lib/store";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/jpeg";
// og:image:alt файлової картинки — експорт alt маршруту, константа модуля:
// від локалі він залежати не може. Тому ім'я латиницею й домен.
export const OG_ALT = "Iwan Kulik · iwankulik.com";

// Фон для сторінок без власного зображення (статичні сторінки, індекс і
// категорії блогу). Спокійніший за інші кадри й достатньо великий
// (1400×1000), щоб не розмиватися на 1200×630.
export const OG_NEUTRAL_BG = "/assets/kulik-chess-02.webp";

const DOMAIN = new URL(SITE_URL).host;

const COLORS = {
  bg: "#171614",
  text: "#EFEBE4",
  name: "rgba(239, 235, 228, 0.86)",
  meta: "rgba(239, 235, 228, 0.6)",
  accent: "#C0873C",
};

// Шрифти читаємо один раз на інстанс функції. Шляхи — літерали від
// process.cwd(): так їх бачить трасування файлів збірки, і шрифти разом із
// public/assets потрапляють у функцію без outputFileTracingIncludes
// (перевірено по route.js.nft.json після збірки).
let fontsPromise;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(path.join(process.cwd(), "lib/fonts/CormorantGaramond-Light.ttf")),
    readFile(path.join(process.cwd(), "lib/fonts/Archivo-Medium.ttf")),
  ])
    .then(([cormorant, archivo]) => [
      { name: "Cormorant Garamond", data: cormorant, weight: 300, style: "normal" },
      { name: "Archivo", data: archivo, weight: 500, style: "normal" },
    ])
    .catch((err) => {
      fontsPromise = undefined;
      throw err;
    });
  return fontsPromise;
}

// Звідки взяти байти картинки за тим самим src, що стоїть на сторінці:
//  - /uploads/* — фото з адмінки: у блобі на Netlify, у content/uploads локально;
//  - https://… — Vercel Blob;
//  - /assets/* та інше з public/ — з диска, а якщо у функції його нема,
//    то з CDN сайту.
async function readImageSource(src) {
  if (/^https?:\/\//.test(src)) return fetchImage(src);
  if (src.startsWith("/uploads/")) {
    const name = path.basename(src);
    if (IS_NETLIFY) return getUploadedImage(name);
    return readFile(path.join(process.cwd(), "content", "uploads", name));
  }
  try {
    return await readFile(path.join(process.cwd(), "public", src));
  } catch {
    return fetchImage(`${SITE_URL}${src}`);
  }
}

// Кешований fetch: fetch без кешу під час пререндеру зробив би маршрут
// динамічним, тобто картинка збиралася б на кожен запит.
async function fetchImage(url) {
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`OG background ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Фон зводимо до рівно 1200×630 JPEG ще до Satori: той не декодує WebP
// (а всі ассети сайту — WebP) і не має кадрування object-fit.
async function backgroundDataUri(src) {
  if (!src) return null;
  try {
    const input = await readImageSource(src);
    if (!input) return null;
    const jpeg = await sharp(input)
      .rotate()
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    // Без фону картка все одно читається — темне тло сайту. Краще так,
    // ніж 500 на запит краулера соцмережі.
    console.error("[og] background failed:", src, err?.message || err);
    return null;
  }
}

// Кегль від довжини: коротка назва циклу стоїть великою, заголовок статті
// на 80 знаків має вміститися в три рядки.
function titleSize(title) {
  const n = title.length;
  if (n <= 24) return 92;
  if (n <= 44) return 76;
  if (n <= 72) return 62;
  return 52;
}

function OgCard({ eyebrow, title, name, background }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        fontFamily: "Cormorant Garamond",
      }}
    >
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={background}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      ) : null}
      {/* Затемнення зліва направо: текст лежить на майже суцільному тлі,
          а праворуч лишається видно живопис. Друге, знизу вгору, тримає
          домен у правому нижньому куті: без нього на світлих ділянках
          картини рядок губився. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          backgroundImage:
            "linear-gradient(90deg, rgba(14,13,12,0.95) 0%, rgba(14,13,12,0.86) 42%, rgba(23,22,20,0.45) 78%, rgba(23,22,20,0.2) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          backgroundImage: "linear-gradient(0deg, rgba(14,13,12,0.8) 0%, rgba(14,13,12,0) 36%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          padding: "60px 72px 56px",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: COLORS.accent }}>
          {eyebrow || ""}
        </div>
        <div style={{ display: "flex", maxWidth: 860, fontSize: titleSize(title), lineHeight: 1.06 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: 72, height: 2, marginBottom: 22, backgroundColor: COLORS.accent }} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 36, color: COLORS.name }}>{name || ""}</div>
            <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 20, letterSpacing: 2, color: COLORS.meta }}>
              {DOMAIN}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {object} p
 * @param {string} p.title - головний рядок картки
 * @param {string} [p.eyebrow] - надрядковий підпис охрою (розділ, категорія)
 * @param {string} [p.name] - ім'я художника внизу; на головній, де ім'я і є заголовком, не передається
 * @param {string} [p.background] - src зображення так, як воно стоїть на сторінці
 */
export async function renderOgImage({ title, eyebrow, name, background }) {
  const [fonts, bg] = await Promise.all([loadFonts(), backgroundDataUri(background)]);
  const png = await new ImageResponse(
    <OgCard title={title} eyebrow={eyebrow} name={name} background={bg} />,
    { ...OG_SIZE, fonts },
  ).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": OG_CONTENT_TYPE } });
}

export function ogNotFound() {
  return new Response("Not found", { status: 404 });
}

// Статичні сторінки (про художника, контакти, живопис, цикли, блог):
// заголовок — той самий seo.{key}.title, що в їхньому generateMetadata.
export async function renderStaticPageOg({ locale }, seoKey) {
  if (!locales.includes(locale)) return ogNotFound();
  const t = getDict(locale);
  return renderOgImage({
    title: ogHeadline(t.seo[seoKey].title, t.name),
    name: t.name,
    background: OG_NEUTRAL_BG,
  });
}
