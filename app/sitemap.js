import { locales } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import {
  CATEGORY_KEYS,
  categorySlug,
  getAllPosts,
  getAllSlugs,
  getPublishedLocales,
  getPostLastModified,
} from "@/lib/blog";
import { cycles } from "@/data/site";

// Карта мусить сама підхоплювати статті, у яких настала дата публікації.
// Без revalidate вона лишається статичною з моменту збірки, і запланована
// стаття не потрапила б у sitemap до наступного деплою.
export const revalidate = 3600;

// lastmod — лише справжня дата зміни. Нема такої — поля нема зовсім
// (Google це допускає). Дату збірки сюди більше не ставимо: карта
// перегенеровується щогодини, і час збірки чи регенерації щоразу казав би
// пошуковику, що змінилося геть усе — сигнал знецінювався.
//
// Звідки дата:
// - статті — updatedAt, інакше publishedAt із frontmatter;
// - індекс блогу — найсвіжіша дата серед опублікованих статей локалі,
//   категорія — серед опублікованих статей цієї категорії в цій локалі:
//   список змінюється саме тоді. Запланована стаття, чия дата настала,
//   сама підніме дату списку на першій регенерації після публікації;
// - головна, zhyvopys, cycles, pro-mene, kontakty і сторінки циклів — без
//   lastmod. Їхній вміст живе у сховищі й правиться з адмінки, а Netlify
//   Blobs часу запису не зберігає. Дата коміту тут брехала б: правки з
//   адмінки в git не потрапляють.

// Дата з frontmatter, якій можна вірити: розбирається й не з майбутнього
// (дата наперед — помилка в даних, а не зміна). Повертає вихідне значення,
// щоб у карті лишився той самий запис, що у файлі статті.
function honestDate(value, now) {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  if (Number.isNaN(time) || time > now) return undefined;
  return value;
}

function latestDate(values, now) {
  let latest;
  let latestTime = -Infinity;
  for (const value of values) {
    const date = honestDate(value, now);
    if (date === undefined) continue;
    const time = new Date(date).getTime();
    if (time > latestTime) {
      latest = date;
      latestTime = time;
    }
  }
  return latest;
}

const lastModifiedField = (date) => (date === undefined ? {} : { lastModified: date });

export default async function sitemap() {
  const pages = ["", "/zhyvopys", "/cycles", "/pro-mene", "/kontakty", "/blog"];
  const entries = [];
  const now = Date.now();

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
    // Уже без запланованих: getAllPosts фільтрує за датою в момент виклику,
    // тобто на кожній регенерації карти.
    const posts = await getAllPosts(locale);
    const postDates = (list) => list.map((post) => post.updatedAt || post.publishedAt);

    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        ...(page === "/blog" ? lastModifiedField(latestDate(postDates(posts), now)) : {}),
        alternates: { languages: langs(page) },
      });
    }
    // Сторінки окремих циклів: шлях однаковий у всіх локалях,
    // тож alternates будуються тим самим langs(), що й решта.
    for (const cycle of cycles) {
      entries.push({
        url: `${SITE_URL}/${locale}/cycles/${cycle.slug}`,
        alternates: { languages: langs(`/cycles/${cycle.slug}`) },
      });
    }
    for (const key of CATEGORY_KEYS) {
      const inCategory = posts.filter((post) => post.category === key);
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${categorySlug(key, locale)}`,
        ...lastModifiedField(latestDate(postDates(inCategory), now)),
        alternates: { languages: langsForCategory(key) },
      });
    }
  }

  // Статті — по одному запису на кожну (локаль, слаг), де файл реально є
  // й дата публікації вже настала. Заплановані сюди не потрапляють: вони
  // віддають 404, а sitemap із 404 псує довіру до всієї карти.
  for (const slug of getAllSlugs()) {
    for (const locale of getPublishedLocales(slug)) {
      entries.push({
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        ...lastModifiedField(honestDate(getPostLastModified(locale, slug), now)),
        alternates: { languages: langsForPost(slug) },
      });
    }
  }

  return entries;
}
