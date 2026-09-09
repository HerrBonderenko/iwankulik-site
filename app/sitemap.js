import { locales } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { CATEGORY_KEYS, categorySlug, getAllSlugs, getAvailableLocales } from "@/lib/blog";
import { cycles } from "@/data/site";

export default async function sitemap() {
  const pages = ["", "/zhyvopys", "/cycles", "/pro-mene", "/kontakty", "/blog"];
  const entries = [];

  // x-default веде на англійську версію — узгоджено з lib/seo.js і з
  // DEFAULT у proxy.js.
  const langs = (path) => ({
    ...Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
    "x-default": `${SITE_URL}/en${path}`,
  });

  // Категорії блогу мають локалізований сегмент URL (/pl/blog/portrety,
  // /de/blog/portraets) — на відміну від решти сторінок сайту, шлях
  // не однаковий для всіх локалей, тож alternates будуємо окремо.
  const langsForCategory = (key) => ({
    ...Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/blog/${categorySlug(key, l)}`])),
    "x-default": `${SITE_URL}/en/blog/${categorySlug(key, "en")}`,
  });

  // Статті блогу існують поки не на всіх 5 мовах — hreflang звужуємо до
  // локалей, де файл реально є, інакше Google побачить alternate на 404.
  const langsForPost = (slug) => {
    const available = getAvailableLocales(slug);
    const map = Object.fromEntries(available.map((l) => [l, `${SITE_URL}/${l}/blog/${slug}`]));
    const defaultLocale = available.includes("en") ? "en" : available[0];
    if (defaultLocale) map["x-default"] = `${SITE_URL}/${defaultLocale}/blog/${slug}`;
    return map;
  };

  for (const locale of locales) {
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        lastModified: new Date(),
        alternates: { languages: langs(page) },
      });
    }
    // Сторінки окремих циклів: шлях однаковий у всіх локалях,
    // тож alternates будуються тим самим langs(), що й решта.
    for (const cycle of cycles) {
      entries.push({
        url: `${SITE_URL}/${locale}/cycles/${cycle.slug}`,
        lastModified: new Date(),
        alternates: { languages: langs(`/cycles/${cycle.slug}`) },
      });
    }
    for (const key of CATEGORY_KEYS) {
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${categorySlug(key, locale)}`,
        lastModified: new Date(),
        alternates: { languages: langsForCategory(key) },
      });
    }
  }

  // Статті — по одному запису на кожну (локаль, слаг), де файл реально є.
  for (const slug of getAllSlugs()) {
    for (const locale of getAvailableLocales(slug)) {
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        lastModified: new Date(),
        alternates: { languages: langsForPost(slug) },
      });
    }
  }

  return entries;
}
