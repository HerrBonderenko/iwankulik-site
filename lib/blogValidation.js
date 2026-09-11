// Перевірка статей блогу на збірці: frontmatter, матриця перекладів і MDX
// запланованих статей. Викликається з generateStaticParams сторінки статті
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
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/blogCategories";
import { renderPost } from "@/lib/blog";

const BLOG_DIR = path.join(process.cwd(), "blog-content");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Невідоме поле — теж помилка: опечатка на кшталт publishAt мовчки зробила б
// заплановану статтю опублікованою (без дати стаття вважається виданою).
const KNOWN_FIELDS = ["title", "description", "category", "author", "cover", "publishedAt", "updatedAt"];
const COVER_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".avif"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_HINT = 'дата "РРРР-ММ-ДД" у лапках, яка існує в календарі, напр. "2026-01-19"';

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
  // [slug] спершу шукає категорію, тож стаття з таким самим слагом була б
  // недосяжна: за її адресою відкривалася б сторінка категорії.
  const shadowedBy = CATEGORY_KEYS.find((key) => CATEGORIES[key].slug[locale] === slug);
  if (shadowedBy) {
    say(null, `слаг збігається зі слагом категорії "${shadowedBy}" — за адресою /${locale}/blog/${slug} відкриється категорія, а стаття стане недосяжною`);
  }

  let data;
  try {
    data = matter(fs.readFileSync(path.join(BLOG_DIR, locale, `${slug}.mdx`), "utf8")).data;
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
    scheduled: Boolean(published) && published.getTime() > Date.now(),
  };
}

/** Усі проблеми контенту блогу: [{ file, locale, field, message }]. */
export async function findBlogContentProblems() {
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
