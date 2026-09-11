// Заготовки schema.org-розмітки для сайту художника: Person, окремі
// роботи (Product/Offer), сторінки-каталоги (CollectionPage), хлібні
// крихти (BreadcrumbList) і бізнес-профіль (LocalBusiness).
import { SITE_URL, localizedUrl, defaultOgImage } from "@/lib/seo";
import { locales, pick } from "@/lib/i18n";
import { AUTHORS } from "@/lib/authors";

// Художник — одна сутність на весь сайт. @id однаковий на всіх мовах і в
// усіх типах: Person у макеті, автор і видавець статті, продавець роботи,
// тема каталогу. Так пошуковик зводить їх в одну особу, а не бачить кілька.
//
// Ім'я — мовою сторінки, як у підписі статті: «Іван Кулік» на uk, «Иван
// Кулик» на ru, «Iwan Kulik» на en/pl/de. Усередині однієї сторінки Person
// і автор Article збігаються дослівно; решта написань лежить в
// alternateName, щоб різні мови не виглядали різними людьми.
const ARTIST_AUTHOR_ID = "iwan-kulik";
const PERSON_ID = `${SITE_URL}/#person`;
// sameAs заповнюється соцмережами художника, поки порожній.
const SAME_AS = [];

const artistName = (locale) => pick(AUTHORS[ARTIST_AUTHOR_ID].name, locale);

// Посилання на художника з інших типів. url — сторінка «Про мене» мовою
// сторінки: вона відповідає 200, а корінь сайту віддає редирект на мову.
function artistRef(locale) {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: artistName(locale),
    url: localizedUrl(locale, "/pro-mene"),
  };
}

export function personSchema(locale) {
  const name = artistName(locale);
  return {
    "@context": "https://schema.org",
    ...artistRef(locale),
    alternateName: [...new Set(locales.map(artistName))].filter((n) => n !== name),
    jobTitle: "Oil painter",
    sameAs: SAME_AS,
  };
}

// Сайт як сутність — по одному на головну кожної локалі, тому url і
// inLanguage локальні, а не кореневі.
//
// SearchAction тут більше нема. Він оголошував пошук за шаблоном
// /zhyvopys?w={search_term_string}, але ?w= відкриває роботу за її id, а не
// шукає текст — тобто описував пошук, якого на сайті нема. І поля пошуку
// у видачі Google за цією розміткою більше не показує (з листопада 2024).
export function websiteSchema({ locale }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Iwan Kulik",
    url: localizedUrl(locale),
    inLanguage: locale,
  };
}

// crumbs: [{ name, path }] у порядку від головної до поточної сторінки,
// path — без локалі (як у buildMetadata), "" для головної.
export function breadcrumbSchema({ locale, crumbs }) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: localizedUrl(locale, crumb.path),
    })),
  };
}

// Один профіль бізнесу на весь сайт — вставляється лише на головній.
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: "Iwan Kulik Art Studio",
    image: defaultOgImage().url,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Warszawa",
      addressCountry: "PL",
    },
    sameAs: SAME_AS,
    areaServed: ["PL", "DE", "AT", "CH", "UA", "IL", "LT", "LV"],
  };
}

// Автор статті — зі списку lib/authors.js (його існування перевіряє
// lib/blogValidation.js на збірці). Художник посилається на свою єдину
// сутність через @id.
function authorRef(authorId, locale) {
  if (authorId === ARTIST_AUTHOR_ID) return artistRef(locale);
  return { "@type": "Person", name: pick(AUTHORS[authorId].name, locale) };
}

// Видавець — сам художник, а не організація. Раніше тут стояла
// Organization «Iwan Kulik Art Studio» з logo = og/default.jpg, тобто
// фрагментом картини замість логотипа. Логотипа в художника нема, а
// сайт він видає як приватна особа; publisher у schema.org може бути й
// Person, і Google для Article logo не вимагає.
export function articleSchema({ locale, path, title, description, image, publishedAt, updatedAt, authorId }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: image ? [image] : undefined,
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: authorRef(authorId, locale),
    publisher: artistRef(locale),
    mainEntityOfPage: { "@type": "WebPage", "@id": localizedUrl(locale, path) },
  };
}

export function collectionPageSchema({ locale, path, name, description, items }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: localizedUrl(locale, path),
    about: artistRef(locale),
    // Каталог робіт, а не фотогалерея: кожен елемент — окрема річ,
    // яку можна купити, тому список іде як ItemList із зображеннями.
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map(({ img, name: itemName }, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: itemName,
        image: absoluteUrl(img),
      })),
    },
  };
}

// Фото роботи може лежати і локально ("/assets/..."), і у Vercel Blob
// (повний https-URL) — у розмітці адреса має бути абсолютною в обох випадках.
function absoluteUrl(url) {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url}`;
}

// Окрема робота як товар. Ціна на сайті зберігається чистим числом
// (див. lib/price.js), валюта завжди EUR.
//
// offers додається завжди, навіть коли ціни нема. Google вимагає в Product
// хоча б одне з offers/review/aggregateRating — без жодного це помилка, а не
// попередження, і робота випадає з товарних результатів цілком. Offer без
// price при наявному availability лишається валідним: price/priceCurrency
// у schema.org не обов'язкові, а вигадувати цифру не можна. Тому в такому
// разі просто немає пари price+priceCurrency — статус наявності при цьому
// чесний: available -> InStock, продано чи приватна колекція -> OutOfStock.
//
// brand — Brand з іменем художника, а не Person: у schema.org brand
// приймає лише Brand чи Organization, а Brand за визначенням — ім'я, під
// яким продає організація або окрема особа. Продавець — сам художник.
export function productSchema(painting, locale) {
  const name = pick(painting.title, locale);
  const tech = painting.tech ? pick(painting.tech, locale) : null;
  const description = [tech, painting.size ? `${painting.size} см` : null, painting.year]
    .filter(Boolean)
    .join(", ");

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: absoluteUrl(painting.img),
    description: description || undefined,
    sku: painting.code || undefined,
    brand: { "@type": "Brand", name: artistName(locale) },
  };

  const price = String(painting.price ?? "").trim();
  data.offers = {
    "@type": "Offer",
    url: `${localizedUrl(locale, "/zhyvopys")}?w=${encodeURIComponent(painting.id)}`,
    availability:
      painting.status === "available"
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    seller: artistRef(locale),
    ...(price ? { priceCurrency: "EUR", price } : {}),
  };

  return data;
}
