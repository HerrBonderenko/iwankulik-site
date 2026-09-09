import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import GithubSlugger from "github-slugger";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { locales } from "@/lib/i18n";
import { getData } from "@/lib/store";

// MDX-джерела лежать поза app/ (код) і поза content/ (рантайм-сховище
// сайту, увесь content/ у .gitignore) — інакше статті ніколи не
// потрапили б у git.
const BLOG_DIR = path.join(process.cwd(), "blog-content");

// Таблиця категорій живе в lib/blogCategories.js — її імпортує ще й
// шапка (клієнтський компонент), а сюди тягнути node:fs їй не можна.
// Реекспорт лишає звичні імпорти з "@/lib/blog" робочими.
export { CATEGORIES, CATEGORY_KEYS, categoryName, categorySlug, categoryKeyFromSlug }
  from "@/lib/blogCategories";

function postFilePath(locale, slug) {
  return path.join(BLOG_DIR, locale, `${slug}.mdx`);
}

export function getPostSlugs(locale) {
  const dir = path.join(BLOG_DIR, locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getAllSlugs() {
  const set = new Set();
  for (const locale of locales) {
    for (const slug of getPostSlugs(locale)) set.add(slug);
  }
  return [...set];
}

// Локалі, для яких існує переклад цієї статті — потрібно для hreflang:
// не можна оголошувати alternate на мову, якої фактично нема (404).
export function getAvailableLocales(slug) {
  return locales.filter((locale) => fs.existsSync(postFilePath(locale, slug)));
}

function readFrontmatter(locale, slug) {
  const file = postFilePath(locale, slug);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return { raw, data, content };
}

// Обкладинку можна замінити з адмінки без правки .mdx-файлів (вони йдуть
// у git і на проді файлова система рантайму read-only) — override живе
// в тому самому JSON-блобі сайту, що й мурали/картини. Слаг спільний для
// всіх мов теми, тож одна обкладинка одразу на всі переклади — це
// свідомо: обкладинка не про мову, а про тему.
export async function getBlogCovers() {
  const data = await getData();
  return data.blogCovers || {};
}

// Alt-описи обкладинок, заданих в адмінці: slug -> {локаль: текст}.
export async function getBlogCoverAlts() {
  const data = await getData();
  return data.blogCoverAlts || {};
}

// blogCovers — необов'язковий параметр: якщо викликач (напр. getAllPosts)
// уже має мапу під рукою, не читаємо store вдруге на кожну статтю.
export async function getPostMeta(locale, slug, blogCovers, blogCoverAlts) {
  const parsed = readFrontmatter(locale, slug);
  if (!parsed) return null;
  const { data, content } = parsed;
  const covers = blogCovers ?? (await getBlogCovers());
  const alts = blogCoverAlts ?? (await getBlogCoverAlts());
  return {
    slug,
    locale,
    title: data.title,
    description: data.description,
    category: data.category,
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt || data.publishedAt,
    cover: covers[slug] || data.cover,
    // Опис із адмінки. Порожній рядок — те саме, що не заданий:
    // сторінка піде до lib/coverAlt.js, а потім до заголовка.
    coverAlt: (alts[slug]?.[locale] || "").trim() || null,
    author: data.author,
    readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
  };
}

export async function getAllPosts(locale) {
  const covers = await getBlogCovers();
  const alts = await getBlogCoverAlts();
  const posts = await Promise.all(
    getPostSlugs(locale).map((slug) => getPostMeta(locale, slug, covers, alts))
  );
  return posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

// Схожі статті — вікно навколо поточної, а не три найсвіжіші в категорії.
// З найсвіжішими виходило погано: у чотирьох із шести статей «колекціонування»
// блок був однаковий, а дві найстаріші не траплялися в ньому жодного разу —
// потрапити на них можна було лише зі списку.
//
// Тут беремо двох сусідів зверху (свіжіші за поточну) і одного знизу
// (старішу). Список відсортований за датою, і край замикається по колу:
// для найсвіжішої статті «сусіди зверху» — найстаріші. Завдяки цьому кожна
// стаття категорії з'являється в «схожих» рівно стільки ж разів, скільки
// й будь-яка інша, і жодна не випадає.
export function pickRelated(posts, slug, count = 3) {
  const n = posts.length;
  const i = posts.findIndex((p) => p.slug === slug);
  if (n <= 1 || i === -1) return [];

  const picked = [];
  const take = (index) => {
    const p = posts[((index % n) + n) % n];
    if (p.slug !== slug && !picked.includes(p) && picked.length < count) picked.push(p);
  };

  for (const offset of [-2, -1, 1]) take(i + offset);
  // Категорія менша за вікно — добираємо по колу, щоб не віддавати
  // менше, ніж узагалі є сусідів.
  for (let k = 1; k < n && picked.length < count; k++) take(i + k);
  return picked;
}

export async function getPostsByCategory(locale, categoryKey) {
  const posts = await getAllPosts(locale);
  return posts.filter((post) => post.category === categoryKey);
}

// Таблиця в статті ширша за екран телефона, а remark-gfm обгортки не
// робить — віддає голий <table>, який розпирає сторінку. Готовий плагін
// заради десяти рядків тягнути ні до чого (і зайва залежність у бандлі),
// тож обходимо дерево самі: кожну таблицю кладемо в контейнер, якому
// globals.css дає горизонтальний скрол.
//
// Обгортка, а не display: block на самій таблиці: з display: block
// таблиця перестає розтягуватись на всю ширину колонки й на широкому
// екрані колонки стискаються по вмісту.
function rehypeWrapTables() {
  return (tree) => {
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        walk(child);
        if (child.type !== "element" || child.tagName !== "table") return child;
        return {
          type: "element",
          tagName: "div",
          properties: { className: ["table-wrap"] },
          children: [child],
        };
      });
    };
    walk(tree);
  };
}

// H2/H3 з сирого markdown — той самий алгоритм слагів, що й у
// rehype-slug (github-slugger), щоб id у ToC збігались з реальними
// заголовками на сторінці.
export function extractHeadings(markdown) {
  const slugger = new GithubSlugger();
  const headings = [];
  for (const line of markdown.split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, "").trim();
    headings.push({ depth: m[1].length, text, id: slugger.slug(text) });
  }
  return headings;
}

export async function renderPost(locale, slug, components = {}) {
  const parsed = readFrontmatter(locale, slug);
  if (!parsed) return null;
  const { raw, content } = parsed;
  const { content: mdxContent, frontmatter } = await compileMDX({
    source: raw,
    components,
    options: {
      parseFrontmatter: true,
      // next-mdx-remote за замовчуванням вирізає {JS-вирази} з MDX
      // (blockJS: true) — захист проти чужого контенту. Наші статті
      // пише тільки власник сайту й вони йдуть у git, тож вимикаємо:
      // без цього пропси на кшталт items={[...]} у <FAQBlock> мовчки
      // ставали undefined.
      blockJS: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }], rehypeWrapTables],
      },
    },
  });
  return {
    content: mdxContent,
    frontmatter,
    headings: extractHeadings(content),
    readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
  };
}

export function formatDate(dateStr, locale) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(dateStr)
  );
}
