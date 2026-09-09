// Спільна побудова метаданих для публічних сторінок сайту: єдиний
// формат canonical/hreflang/OG/twitter, щоб кожна сторінка мала свій
// унікальний canonical замість успадкованого з /{locale} (як було раніше).
import { locales } from "@/lib/i18n";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iwankulik.com";

// x-default веде на англійську версію. Це не про ринок (основні — Польща
// й Німеччина, у них свої hreflang), а про те, кому цей тег адресований:
// відвідувачу, чия мова не збіглася з жодною з п'яти. Саме його proxy.js
// відправляє на /en (DEFAULT там теж "en"), тож тег і реальний редирект
// кореня тепер кажуть одне й те саме.
const X_DEFAULT_LOCALE = "en";

export function localizedUrl(locale, path = "") {
  return `${SITE_URL}/${locale}${path}`;
}

// pathOrMap — або той самий шлях для всіх локалей (звичайні сторінки),
// або мапа { locale: path } для сторінок з локалізованим сегментом URL
// (напр. категорії блогу: /pl/blog/portrety, /de/blog/portraets).
// availableLocales звужує список — потрібно для статей блогу, які поки
// перекладені не на всі 5 мов: не можна оголошувати hreflang на 404.
function languageAlternates(pathOrMap, availableLocales) {
  const pathFor = (l) => (typeof pathOrMap === "object" ? pathOrMap[l] : pathOrMap);
  const list = availableLocales ?? locales;
  const result = Object.fromEntries(list.map((l) => [l, localizedUrl(l, pathFor(l))]));
  const defaultLocale = list.includes(X_DEFAULT_LOCALE) ? X_DEFAULT_LOCALE : list[0];
  if (defaultLocale) result["x-default"] = localizedUrl(defaultLocale, pathFor(defaultLocale));
  return result;
}

/**
 * Перше речення тексту — для meta description. Шаблон «{title} — цикл
 * олійного живопису» описував будь-який цикл однаково; перше речення
 * опису каже про конкретний.
 *
 * Межа речення — крапка, знак оклику чи питання, за якими пробіл або
 * кінець рядка (кома й двокрапка речення не закривають). Якщо воно довше
 * за ліміт, ріжемо по останньому пробілу перед межею, щоб не рвати слово.
 */
export function leadSentence(text, limit = 160) {
  const first = String(text || "").split(/\n\s*\n/)[0].trim();
  if (!first) return "";
  const match = first.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const sentence = (match ? match[0] : first).trim();
  if (sentence.length <= limit) return sentence;
  const head = sentence.slice(0, limit + 1);
  const space = head.lastIndexOf(" ");
  const cut = space > 0 ? head.slice(0, space) : sentence.slice(0, limit);
  return `${cut.replace(/[\s.,:;—-]+$/, "")}…`;
}

export function defaultOgImage() {
  return { url: `${SITE_URL}/og/default.jpg`, width: 1200, height: 630 };
}

/**
 * @param {object} p
 * @param {string} p.locale
 * @param {string} p.path - шлях без локалі, напр. "" | "/kontakty" | "/zhyvopys"
 * @param {string} p.title
 * @param {string} p.description
 * @param {string} p.siteName
 * @param {{url:string,width?:number,height?:number,alt?:string}} [p.image]
 * @param {"website"|"article"} [p.type]
 * @param {Object.<string,string>} [p.localizedPaths] - мапа {locale: path} замість спільного p.path, для сторінок з локалізованим сегментом URL (категорії блогу)
 * @param {string[]} [p.availableLocales] - звузити hreflang до локалей, де контент реально існує (статті блогу)
 */
export function buildMetadata({ locale, path, localizedPaths, availableLocales, title, description, siteName, image, type = "website" }) {
  const url = localizedUrl(locale, localizedPaths ? localizedPaths[locale] : path);
  const ogImage = image ? { width: 1200, height: 630, alt: title, ...image } : { ...defaultOgImage(), alt: title };

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(localizedPaths ?? path, availableLocales),
    },
    openGraph: {
      type,
      locale,
      alternateLocale: (availableLocales ?? locales).filter((l) => l !== locale),
      url,
      siteName,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}
