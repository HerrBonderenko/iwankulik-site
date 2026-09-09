import { NextResponse } from "next/server";

const locales = ["uk", "en", "pl", "de", "ru"];
const DEFAULT = "en";

// Мова браузера → мова сайту. Усі інші мови (французька, іспанська,
// чеська…) — англійська: вона зрозуміліша за польською для випадкового
// відвідувача.
const MAP = {
  pl: "pl",
  uk: "uk", be: "uk",
  de: "de", at: "de", ch: "de",
  ru: "ru",
  en: "en",
};

function detect(header) {
  if (!header) return DEFAULT;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    const base = tag.split("-")[0];
    if (MAP[base]) return MAP[base];
  }
  return DEFAULT;
}

export default function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (hasLocale) return NextResponse.next();

  const cookie = request.cookies.get("locale")?.value;
  const locale = locales.includes(cookie)
    ? cookie
    : detect(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

// Проксі чіпає лише сторінки: усе, що нижче, воно пропускає повз себе.
//
// Іконки раніше були перелічені поіменно (favicon.ico, apple-icon.png,
// icon-512.png…) — і кожен новий файл доводилося дописувати сюди руками,
// інакше запит до нього ловив редірект локалі. Замість списку — правило
// за розширенням: будь-який файл-зображення в корені.
//
// `[^/]+` не переходить через слеш, тож правило стосується саме кореня:
// /icon-192.png воно виключає, а /uk/щось.png — ні (такого в нас і нема,
// але межу краще тримати вузькою). Каталоги з картинками (assets, og,
// uploads) виключені окремо вище — вони мають вкладеність.
export const config = {
  matcher: [
    "/((?!api|admin|_next|assets|uploads|og|blog/|sitemap.xml|image-sitemap.xml|robots.txt|manifest.webmanifest|[^/]+\\.(?:png|ico|svg|webp|jpe?g|avif|gif)$).*)",
  ],
};
