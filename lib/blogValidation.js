// Перевірка статей блогу на збірці: frontmatter, матриця перекладів,
// посилання між статтями й MDX запланованих статей. Викликається з
// generateStaticParams сторінки статті
// (app/(site)/[locale]/blog/[slug]/page.js). За документацією Next ця
// функція виконується під час next build (і в next dev, коли відкриваєш
// маршрут), але не під час ISR-регенерації — тож рантайм на Netlify
// перевірка не чіпає. Адмінку теж: вона .mdx не пише, лише читає статті й
// кладе у сховище заміну обкладинки.
//
// Навіщо: без перевірки битий frontmatter проходив збірку мовчки й ламався
// вже у відвідувача — Person без імені в розмітці Article, обкладинка, що
// віддає 400, а title числом валив збірку повідомленням, яке не називало
// ні файлу, ні поля.
//
// Помилки не кидаються по одній: збираємо всі й падаємо один раз зі
// списком, згрупованим за файлами, щоб полагодити все за один підхід.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { locales } from "@/lib/i18n";
import { AUTHORS } from "@/lib/authors";
import { CATEGORIES, CATEGORY_KEYS, categoryKeyFromAnySlug, categorySlug } from "@/lib/blogCategories";
import { renderPost } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

const BLOG_DIR = path.join(process.cwd(), "blog-content");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Невідоме поле — теж помилка: опечатка на кшталт publishAt мовчки зробила б
// заплановану статтю опублікованою (без дати стаття вважається виданою).
const KNOWN_FIELDS = ["title", "description", "category", "author", "cover", "publishedAt", "updatedAt"];
const COVER_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".avif"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_HINT = 'дата "РРРР-ММ-ДД" у лапках, яка існує в календарі, напр. "2026-01-19"';

// Посилання в тексті статті: markdown [текст](адреса) і href="…" у JSX.
// Повна адреса сайту зводиться до шляху; відносні, зовнішні й не блогові
// посилання не перевіряються. Хостів два: у .env.local NEXT_PUBLIC_SITE_URL
// веде на localhost, а в текст автор вставляє адресу з проду, і локальна
// збірка без другого хоста пропустила б таке посилання мовчки.
const LINK_RE = /\]\(\s*<?([^\s)>]+)>?[^)]*\)|\bhref=\{?\s*["'`]([^"'`]+)["'`]/g;
const SITE_HOSTS = [...new Set([new URL(SITE_URL).host, "iwankulik.com"].map((h) => h.replace(/^www\./, "")))];
const SITE_ORIGIN_RE = new RegExp(
  `^https?://(?:www\\.)?(?:${SITE_HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|")})(?=[/?#]|$)`,
  "i"
);

// Як показати значення в повідомленні, щоб одразу було видно, що не так.
function describe(value) {
  if (value === undefined) return "поля нема";
  if (value === null) return "порожнє значення";
  if (value instanceof Date) return "дата без лапок (YAML робить з неї об'єкт Date, а не рядок)";
  if (Array.isArray(value)) return `список ${JSON.stringify(value)}`;
  if (typeof value === "number") return `число ${value}`;
  if (typeof value === "boolean") return `логічне значення ${value}`;
  if (typeof value === "object") return `об'єкт ${JSON.stringify(value)}`;
  return JSON.stringify(value);
}

// Рівно "РРРР-ММ-ДД", і такий день існує: new Date("2026-02-30") без
// жодної скарги перетворюється на 2 березня.
function parseDay(value) {
  if (typeof value !== "string") return null;
  const m = DAY_RE.exec(value);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const exists = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return exists ? date : null;
}

function isFile(fullPath) {
  try {
    return fs.statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

const firstLine = (text) => String(text).split("\n")[0].slice(0, 300);

// Причина помилки компіляції MDX. next-mdx-remote загортає її в кілька
// рядків: перший — службовий префікс "[next-mdx-remote] error compiling
// MDX:", а сама причина з номером рядка йде далі. Беремо змістовні рядки
// без префікса й без хвоста з посиланням на документацію.
function mdxReason(err) {
  const lines = String(err?.message || err)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[next-mdx-remote]") && !/^More information/i.test(line));
  return (lines.slice(0, 2).join(" ") || firstLine(err?.message || err)).slice(0, 300);
}

function checkPost(locale, slug, report) {
  const file = `blog-content/${locale}/${slug}.mdx`;
  const say = (field, message) => report({ file, locale, field, message });

  if (!SLUG_RE.test(slug)) {
    say(null, `назва файлу "${slug}" не годиться для адреси — лише малі латинські літери, цифри й одинарні дефіси між ними`);
  }
  // [slug] спершу шукає категорію, а proxy.js переводить слаг категорії
  // іншою мовою на слаг цієї (/de/blog/tsykly → /de/blog/zyklen). Тож
  // стаття зі слагом будь-якої категорії будь-якою мовою була б недосяжна:
  // за її адресою відкривалася б категорія або редирект на неї.
  const shadowedBy = CATEGORY_KEYS.flatMap((key) =>
    locales.filter((l) => CATEGORIES[key].slug[l] === slug).map((l) => ({ key, l }))
  )[0];
  if (shadowedBy) {
    const what = shadowedBy.l === locale ? "відкриється категорія" : `proxy перенаправить на категорію (це її слаг мовою ${shadowedBy.l})`;
    say(null, `слаг збігається зі слагом категорії "${shadowedBy.key}" — за адресою /${locale}/blog/${slug} ${what}, а стаття стане недосяжною`);
  }

  let text;
  let data;
  try {
    text = fs.readFileSync(path.join(BLOG_DIR, locale, `${slug}.mdx`), "utf8");
    data = matter(text).data;
  } catch (err) {
    say(null, `frontmatter не розбирається як YAML: ${firstLine(err.message)}`);
    return null;
  }

  for (const key of Object.keys(data)) {
    if (!KNOWN_FIELDS.includes(key)) {
      say(key, `невідоме поле — можливо, опечатка; дозволені поля: ${KNOWN_FIELDS.join(", ")}`);
    }
  }

  for (const field of ["title", "description"]) {
    const value = data[field];
    if (typeof value !== "string" || !value.trim()) {
      say(field, `${describe(value)} — очікувався непорожній рядок у лапках`);
    }
  }

  if (typeof data.category !== "string" || !CATEGORIES[data.category]) {
    say("category", `${describe(data.category)} — очікувалась одна з категорій lib/blogCategories.js: ${CATEGORY_KEYS.join(", ")}`);
  }

  if (typeof data.author !== "string" || !AUTHORS[data.author]) {
    say("author", `${describe(data.author)} — такого автора нема в lib/authors.js (без нього розмітка Article отримує Person без імені); очікувався один з: ${Object.keys(AUTHORS).join(", ")}`);
  }

  const cover = data.cover;
  if (typeof cover !== "string" || !cover.startsWith("/") || cover.includes("..")) {
    say("cover", `${describe(cover)} — очікувався шлях до картинки від кореня сайту, напр. "/assets/hero-work.webp"`);
  } else if (!COVER_EXTENSIONS.includes(path.extname(cover).toLowerCase())) {
    say("cover", `"${cover}" — очікувалась картинка з розширенням ${COVER_EXTENSIONS.join(", ")}`);
  } else if (!isFile(path.join(PUBLIC_DIR, cover))) {
    say("cover", `файлу public${cover} нема на диску — next/image віддасть 400, у відвідувача буде бита картинка`);
  }

  // Дата в майбутньому — не помилка: стаття запланована й чекає свого дня.
  const published = parseDay(data.publishedAt);
  if (!published) {
    say("publishedAt", `${describe(data.publishedAt)} — очікувалась ${DAY_HINT}`);
  }
  if (data.updatedAt !== undefined) {
    const updated = parseDay(data.updatedAt);
    if (!updated) {
      say("updatedAt", `${describe(data.updatedAt)} — очікувалась ${DAY_HINT}, або приберіть поле`);
    } else if (published && updated < published) {
      say("updatedAt", `"${data.updatedAt}" раніше за publishedAt "${data.publishedAt}" — оновлення не може бути до публікації`);
    }
  }

  return {
    file,
    locale,
    slug,
    publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : describe(data.publishedAt),
    category: typeof data.category === "string" ? data.category : describe(data.category),
    published,
    scheduled: Boolean(published) && published.getTime() > Date.now(),
    text,
  };
}

// Посилання з однієї статті на іншу. Читач бачить статтю від її дати (або
// вже зараз, якщо дата минула), тож ціль мусить відкриватися не пізніше:
// дата цілі ≤ max(дата джерела, сьогодні). Інакше посилання в тексті веде
// на 404, і помітить це лише читач. На ISR перевірка не запускається, але
// правило від цього не ламається: дати не рухаються назад, і те, що
// пройшло на збірці, лишається правдою й далі.
function checkPostLinks(posts, report, now = Date.now()) {
  const byKey = new Map(posts.map((p) => [`${p.locale}/${p.slug}`, p]));
  for (const post of posts) {
    for (const match of post.text.matchAll(LINK_RE)) {
      const href = match[1] ?? match[2];
      const pathname = href.replace(SITE_ORIGIN_RE, "").split(/[?#]/)[0];
      if (!pathname.startsWith("/")) continue;
      const segments = pathname.split("/").filter(Boolean);
      const blogAt = segments.indexOf("blog");
      if (blogAt !== 0 && blogAt !== 1) continue;

      const line = post.text.slice(0, match.index).split("\n").length;
      const say = (message) =>
        report({ file: post.file, locale: post.locale, field: null, message: `рядок ${line}, посилання ${href} — ${message}` });

      if (blogAt === 0) {
        say(`без мови в адресі: proxy відправить читача на мову його браузера, а не цієї статті; пишіть /${post.locale}${pathname}`);
        continue;
      }
      const [locale, , slug, ...rest] = segments;
      if (locale !== post.locale) {
        say(`веде на іншу мову (${locale}); зі статті мовою ${post.locale} посилання мають вести на /${post.locale}/blog/…`);
        continue;
      }
      if (!slug) continue; // список статей
      if (rest.length) {
        say(`після слагу зайві сегменти — такої сторінки нема, буде 404`);
        continue;
      }
      if (CATEGORY_KEYS.some((key) => CATEGORIES[key].slug[locale] === slug)) continue;
      const foreignCategory = categoryKeyFromAnySlug(slug);
      if (foreignCategory) {
        say(`слаг категорії іншою мовою: спрацює лише через редирект; пишіть /${locale}/blog/${categorySlug(foreignCategory, locale)}`);
        continue;
      }

      const target = byKey.get(`${locale}/${slug}`);
      if (!target) {
        say(`статті blog-content/${locale}/${slug}.mdx нема — читач отримає 404`);
        continue;
      }
      // Биту дату вже названо вище окремою помилкою.
      if (!post.published || !target.published) continue;
      if (target.published.getTime() > Math.max(post.published.getTime(), now)) {
        const [visible, fix] = post.published.getTime() <= now
          ? ["вже опублікована", "дату, яка вже настала"]
          : [`відкривається ${post.publishedAt}`, `дату не пізнішу за ${post.publishedAt}`];
        say(`стаття «${slug}» відкривається ${target.publishedAt}, а ця ${visible}, тож до ${target.publishedAt} посилання вестиме на 404. Приберіть посилання або дайте цілі ${fix}`);
      }
    }
  }
}

/** Усі проблеми контенту блогу: [{ file, locale, field, message }]. */
async function findBlogContentProblems() {
  const problems = [];
  const report = (problem) => problems.push(problem);
  const posts = [];
  const slugLocales = new Map();

  for (const locale of locales) {
    const dir = path.join(BLOG_DIR, locale);
    if (!fs.existsSync(dir)) {
      report({ file: `blog-content/${locale}/`, locale, field: null, message: "теки нема — у кожної мови має бути своя тека зі статтями" });
      continue;
    }
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx")).sort()) {
      const slug = name.slice(0, -".mdx".length);
      if (!slugLocales.has(slug)) slugLocales.set(slug, []);
      slugLocales.get(slug).push(locale);
      const post = checkPost(locale, slug, report);
      if (post) posts.push(post);
    }
  }

  // Матриця перекладів: перемикач мови веде на /{мова}/blog/{слаг} для всіх
  // п'яти мов, тож без файлу котроїсь із них відвідувач отримав би 404.
  for (const [slug, present] of slugLocales) {
    const missing = locales.filter((l) => !present.includes(l));
    if (missing.length) {
      report({
        file: `blog-content/*/${slug}.mdx`,
        locale: null,
        field: null,
        message: `перекладу нема для: ${missing.join(", ")} (є: ${present.join(", ")}) — у кожної статті мають бути всі ${locales.length} мов`,
      });
    }
  }

  // Дата й категорія — властивості теми, а не перекладу: з різними
  // значеннями стаття виходила б мовами в різні дні й жила б у різних
  // категоріях, а перемикач і hreflang вели б на 404.
  const bySlug = new Map();
  for (const post of posts) {
    if (!bySlug.has(post.slug)) bySlug.set(post.slug, []);
    bySlug.get(post.slug).push(post);
  }
  for (const [slug, list] of bySlug) {
    for (const field of ["publishedAt", "category"]) {
      const values = new Set(list.map((p) => p[field]));
      if (values.size > 1) {
        report({
          file: `blog-content/*/${slug}.mdx`,
          locale: null,
          field,
          message: `різне в перекладах (${list.map((p) => `${p.locale}: ${p[field]}`).join(", ")}) — має бути однаковим у всіх мовах`,
        });
      }
    }
  }

  checkPostLinks(posts, report);

  // MDX опублікованих статей компілює сам пререндер цієї ж збірки.
  // Заплановані не пререндеряться, і їхня помилка в тексті вилізла б лише
  // в день публікації — вже на проді. Лише на збірці: у next dev сторінки
  // й так компілюються при відкритті, а тут це зайві пів секунди на кожен
  // перехід.
  if (process.env.NODE_ENV === "production") {
    for (const post of posts.filter((p) => p.scheduled)) {
      try {
        await renderPost(post.locale, post.slug);
      } catch (err) {
        report({
          file: post.file,
          locale: post.locale,
          field: null,
          message: `MDX не компілюється: ${mdxReason(err)} — стаття запланована на ${post.publishedAt}, і без цієї перевірки помилка вилізла б лише в день публікації`,
        });
      }
    }
  }

  return problems;
}

function formatProblems(problems) {
  const byFile = new Map();
  for (const p of problems) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  const lines = [`Контент блогу не пройшов перевірку — помилок: ${problems.length}, файлів: ${byFile.size}.`, ""];
  for (const [file, list] of byFile) {
    lines.push(list[0].locale ? `${file} (мова: ${list[0].locale})` : file);
    for (const p of list) lines.push(`  • ${p.field ? `${p.field}: ` : ""}${p.message}`);
    lines.push("");
  }
  lines.push("Правила перевірки — lib/blogValidation.js. Дата публікації в майбутньому помилкою не є.");
  return lines.join("\n");
}

/** Кидає одну помилку зі списком усіх проблем, якщо вони є. */
export async function assertBlogContent() {
  const problems = await findBlogContentProblems();
  if (problems.length) throw new Error(formatProblems(problems));
}
