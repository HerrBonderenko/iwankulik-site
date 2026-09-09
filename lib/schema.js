// Заготовки schema.org-розмітки для сайту художника: Person, окремі
// роботи (Product/Offer), сторінки-каталоги (CollectionPage), хлібні
// крихти (BreadcrumbList) і бізнес-профіль (LocalBusiness).
import { SITE_URL, localizedUrl, defaultOgImage } from "@/lib/seo";
import { pick } from "@/lib/i18n";

const PERSON = {
  "@type": "Person",
  name: "Iwan Kulik",
  alternateName: "Іван Кулік",
  jobTitle: "Oil painter",
  url: SITE_URL,
  sameAs: [],
};

export function personSchema() {
  return { "@context": "https://schema.org", ...PERSON };
}

// Сайт як сутність — по одному на головну кожної локалі, тому url і
// inLanguage локальні, а не кореневі.
//
// potentialAction описує пошук за постійним номером роботи з футера
// (WorkCodeSearch): він приводить до /{locale}/zhyvopys?w=…, і саме цей
// шаблон тут і оголошено.
export function websiteSchema({ locale }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Iwan Kulik",
    url: localizedUrl(locale),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${localizedUrl(locale, "/zhyvopys")}?w={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
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
// sameAs заповнюється соцмережами художника (Instagram, Facebook тощо),
// поки порожній.
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
    sameAs: PERSON.sameAs,
    areaServed: ["PL", "DE", "AT", "CH", "UA", "IL", "LT", "LV"],
  };
}

export function articleSchema({ locale, path, title, description, image, publishedAt, updatedAt, authorName }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: image ? [image] : undefined,
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: { "@type": "Person", name: authorName, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Iwan Kulik Art Studio",
      logo: { "@type": "ImageObject", url: defaultOgImage().url },
    },
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
    about: PERSON,
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
    brand: { "@type": "Person", name: PERSON.name },
  };

  const price = String(painting.price ?? "").trim();
  data.offers = {
    "@type": "Offer",
    url: `${localizedUrl(locale, "/zhyvopys")}?w=${encodeURIComponent(painting.id)}`,
    availability:
      painting.status === "available"
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    seller: { "@type": "Person", name: PERSON.name },
    ...(price ? { priceCurrency: "EUR", price } : {}),
  };

  return data;
}
