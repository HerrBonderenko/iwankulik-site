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

// Шлях із розширенням в останньому сегменті — файл: sitemap.xml,
// robots.txt, іконки, /assets/*, /og/*, /uploads/*. Його віддаємо як є,
// без мови, і новий статичний файл більше нікуди вписувати не треба.
//
// Відоме обмеження: слаг, що закінчується крапкою з літерами чи цифрами
// (version-2.0), сприйметься як файл і редиректу не отримає. Таких
// слагів нема ні в статей, ні в категорій, ні в циклів; крапка всередині
// слага безпечна — $ дивиться лише на кінець шляху.
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

export default function proxy(request) {
  const { pathname } = request.nextUrl;
  if (HAS_EXTENSION.test(pathname)) return NextResponse.next();

  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (hasLocale) return NextResponse.next();

  const cookie = request.cookies.get("locale")?.value;
  const locale = locales.includes(cookie)
    ? cookie
    : detect(request.headers.get("accept-language"));

  // clone() зберігає query: /blog/x?utm_source=… → /en/blog/x?utm_source=…
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

// Проксі чіпає лише сторінки. Сторінку від файлу відрізняємо за формою
// шляху (HAS_EXTENSION вище), а не за переліком винятків.
//
// Раніше тут був чорний список: api|admin|_next|assets|uploads|og|blog/|
// sitemap.xml|… Він приїхав із сайту fedotiuk.com разом із "blog/": там
// обкладинки статей лежали в public/blog/*.jpg, і проксі редиректив їх на
// /{locale}/blog/….jpg, ламаючи next/image. Тут public/blog ніколи не
// було (обкладинки в /assets), тож "blog/" нічого не захищав — лише
// забирав адреси статей без мови: /blog/<слаг> віддавав 404, поки /blog і
// /kontakty редиректили. Решта винятків не мала межі сегмента й теж
// ковтала чужі шляхи: "og" — будь-що на og… (/ogrody), "api" — /apiary,
// "admin" — /administrator.
//
// У матчері лишаються тільки шляхи без розширення, які редиректити не
// можна: /api/*, /admin, /admin/*, /_next/* (/_next/image теж без
// розширення) і /_vercel/*. (?:/|$) тримає межу сегмента.
export const config = {
  matcher: ["/((?!(?:api|admin|_next|_vercel)(?:/|$)).*)"],
};
