import { locales } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import {
  CATEGORY_KEYS,
  categorySlug,
  getAllSlugs,
  getPublishedLocales,
  getPostLastModified,
} from "@/lib/blog";
import { cycles } from "@/data/site";

// Карта мусить сама підхоплювати статті, у яких настала дата публікації.
// Без revalidate вона лишається статичною з моменту збірки, і запланована
// стаття не потрапила б у sitemap до наступного деплою.
export const revalidate = 3600;

export default async function sitemap() {
  const pages = ["", "/zhyvopys", "/cycles", "/pro-mene", "/kontakty", "/blog"];
  const entries = [];

  // Один timestamp на всю карту, а не new Date() на кожен запис: інакше
  // сторінки різняться мілісекундами й виглядають як 225 різних правок.
  // Для сторінок, вміст яких лежить у коді та data/site.js, дата збірки —
  // це і є дата останньої зміни: вони перегенеровуються кожним деплоєм.
  const buildDate = new Date();

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
  // локалей, де файл реально є й уже опублікований, інакше Google
  // побачить alternate на 404.
  const langsForPost = (slug) => {
    const available = getPublishedLocales(slug);
    const map = Object.fromEntries(available.map((l) => [l, `${SITE_URL}/${l}/blog/${slug}`]));
    const defaultLocale = available.includes("en") ? "en" : available[0];
    if (defaultLocale) map["x-default"] = `${SITE_URL}/${defaultLocale}/blog/${slug}`;
    return map;
  };

  for (const locale of locales) {
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        lastModified: buildDate,
        alternates: { languages: langs(page) },
      });
    }
    // Сторінки окремих циклів: шлях однаковий у всіх локалях,
    // тож alternates будуються тим самим langs(), що й решта.
    for (const cycle of cycles) {
      entries.push({
        url: `${SITE_URL}/${locale}/cycles/${cycle.slug}`,
        lastModified: buildDate,
        alternates: { languages: langs(`/cycles/${cycle.slug}`) },
      });
    }
    for (const key of CATEGORY_KEYS) {
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${categorySlug(key, locale)}`,
        lastModified: buildDate,
        alternates: { languages: langsForCategory(key) },
      });
    }
  }

  // Статті — по одному запису на кожну (локаль, слаг), де файл реально є
  // й дата публікації вже настала. Заплановані сюди не потрапляють: вони
  // віддають 404, а sitemap із 404 псує довіру до всієї карти.
  // lastmod береться з frontmatter статті (updatedAt, інакше publishedAt),
  // а не з часу збірки: інакше кожен деплой повідомляє Google, що
  // змінилися геть усі статті, і сигнал знецінюється.
  for (const slug of getAllSlugs()) {
    for (const locale of getPublishedLocales(slug)) {
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        lastModified: getPostLastModified(locale, slug) || buildDate,
        alternates: { languages: langsForPost(slug) },
      });
    }
  }

  return entries;
}
