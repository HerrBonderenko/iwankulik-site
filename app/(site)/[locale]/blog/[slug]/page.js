import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, pick, locales } from "@/lib/i18n";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { breadcrumbSchema, collectionPageSchema, articleSchema } from "@/lib/schema";
import {
  CATEGORY_KEYS,
  categoryKeyFromSlug,
  categoryName,
  categorySlug,
  getPostsByCategory,
  getPostMeta,
  getPostSlugs,
  getAvailableLocales,
  renderPost,
} from "@/lib/blog";
import { getAuthor } from "@/lib/authors";
import JsonLd from "@/components/JsonLd";
import BlogCard from "@/components/blog/BlogCard";
import BlogMeta from "@/components/blog/BlogMeta";
import BlogToC from "@/components/blog/BlogToC";
import RelatedPosts from "@/components/blog/RelatedPosts";
import FAQBlock from "@/components/blog/FAQBlock";

// Next.js не дозволяє двом сусіднім папкам на одному рівні мати різні
// імена динамічного сегмента ([category] і [slug] одночасно під /blog/
// зіткнулися б — "You cannot use different slug names for the same
// dynamic path"). Тому категорія й стаття живуть в одному [slug]/page.js
// і розрізняються в рантаймі: спершу перевіряємо, чи це відомий
// (локалізований) слаг категорії, інакше шукаємо статтю з таким слагом.
export function generateStaticParams() {
  const params = [];
  for (const locale of locales) {
    for (const key of CATEGORY_KEYS) {
      params.push({ locale, slug: categorySlug(key, locale) });
    }
    for (const slug of getPostSlugs(locale)) {
      params.push({ locale, slug });
    }
  }
  // ТИМЧАСОВО: діагностика 404 на проді. Прибрати після з'ясування.
  console.log(
    `[build-diag] blog/[slug]: cwd=${process.cwd()} locales=${locales.length} ` +
      `→ ${params.length} шляхів; приклад=${params[0] ? `${params[0].locale}/${params[0].slug}` : "НЕМАЄ"}`
  );
  return params;
}

// У кожної категорії свій опис (seo.blog.categories), інакше індекс блогу
// й усі три категорії йшли б у видачу з однаковим description — а це
// чотири сторінки на локаль, двадцять на сайт. Загальний опис журналу
// лишається запасним на випадок нової категорії без свого тексту.
function categoryDescription(t, key) {
  return t.seo.blog.categories?.[key] || t.seo.blog.description;
}

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const t = getDict(locale);

  const categoryKey = categoryKeyFromSlug(locale, slug);
  if (categoryKey) {
    const localizedPaths = Object.fromEntries(
      locales.map((l) => [l, `/blog/${categorySlug(categoryKey, l)}`])
    );
    return buildMetadata({
      locale,
      localizedPaths,
      title: `${categoryName(categoryKey, locale)} — ${t.blog.title} | ${t.name}`,
      description: categoryDescription(t, categoryKey),
      siteName: t.name,
    });
  }

  const post = await getPostMeta(locale, slug);
  if (!post) return {};
  return buildMetadata({
    locale,
    path: `/blog/${slug}`,
    availableLocales: getAvailableLocales(slug),
    title: post.title,
    description: post.description,
    siteName: t.name,
    image: { url: `${SITE_URL}${post.cover}` },
    type: "article",
  });
}

// Набір слагів відомий на збірці, тож усе інше — не «сторінка, яку
// треба спробувати відрендерити», а адреса, якої в застосунку нема.
// dynamicParams: false віддає її маршрутизатору, і 404 малює наш
// app/not-found.js із шапкою й футером, а не вбудована заглушка
// (власної межі not-found у групи (site) бути не може — два
// кореневі макети, див. коментар в app/not-found.js).
export const dynamicParams = false;

export const revalidate = 60;

export default async function BlogSlugPage({ params }) {
  const { locale, slug } = await params;
  const t = getDict(locale);

  const categoryKey = categoryKeyFromSlug(locale, slug);
  if (categoryKey) {
    return <CategoryView locale={locale} t={t} categoryKey={categoryKey} />;
  }

  const post = await getPostMeta(locale, slug);
  if (!post) notFound();
  return <ArticleView locale={locale} t={t} slug={slug} post={post} />;
}

async function CategoryView({ locale, t, categoryKey }) {
  const posts = await getPostsByCategory(locale, categoryKey);
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.blog.title, path: "/blog" },
      { name: categoryName(categoryKey, locale), path: `/blog/${categorySlug(categoryKey, locale)}` },
    ],
  });
  const collection = collectionPageSchema({
    locale,
    path: `/blog/${categorySlug(categoryKey, locale)}`,
    name: categoryName(categoryKey, locale),
    description: categoryDescription(t, categoryKey),
    items: posts.map((p) => ({ img: p.cover, name: p.title })),
  });

  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <JsonLd data={collection} />
      <section className="section" style={{ borderBottom: "none" }}>
        <h1 className="section-title">{categoryName(categoryKey, locale)}</h1>
        <div className="filter blog-categories">
          <Link href={`/${locale}/blog`}>{t.blog.categoryAll}</Link>
          {CATEGORY_KEYS.map((key) => (
            <Link
              key={key}
              href={`/${locale}/blog/${categorySlug(key, locale)}`}
              className={key === categoryKey ? "active" : undefined}
            >
              {categoryName(key, locale)}
            </Link>
          ))}
        </div>
        {posts.length === 0 ? (
          <p className="muted">{t.blog.noPosts}</p>
        ) : (
          <div className="grid-3 blog-grid">
            {posts.map((post) => (
              <BlogCard key={post.slug} locale={locale} t={t} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function ArticleView({ locale, t, slug, post }) {
  const rendered = await renderPost(locale, slug, { FAQBlock });
  if (!rendered) notFound();
  const author = getAuthor(post.author);
  const related = (await getPostsByCategory(locale, post.category))
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.blog.title, path: "/blog" },
      { name: categoryName(post.category, locale), path: `/blog/${categorySlug(post.category, locale)}` },
      { name: post.title, path: `/blog/${slug}` },
    ],
  });
  const article = articleSchema({
    locale,
    path: `/blog/${slug}`,
    title: post.title,
    description: post.description,
    image: `${SITE_URL}${post.cover}`,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    authorName: author ? pick(author.name, locale) : undefined,
  });

  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <JsonLd data={article} />
      <article className="section blog-article" style={{ borderBottom: "none" }}>
        <span className="blog-card-category">
          <Link href={`/${locale}/blog/${categorySlug(post.category, locale)}`}>
            {categoryName(post.category, locale)}
          </Link>
        </span>
        <h1 className="section-title">{post.title}</h1>
        <BlogMeta
          locale={locale}
          t={t}
          author={author}
          publishedAt={post.publishedAt}
          updatedAt={post.updatedAt}
          readingMinutes={rendered.readingMinutes}
        />
        {post.cover && (
          <div className="object-hero" style={{ marginTop: 24 }}>
            {/* Обкладинка — LCP сторінки статті: стоїть одразу під
                заголовком і на весь її стовпчик. */}
            <Image src={post.cover} alt={post.title} fill priority sizes="(max-width: 800px) 100vw, 760px" />
          </div>
        )}
        <BlogToC t={t} headings={rendered.headings} />
        <div className="blog-content">{rendered.content}</div>
      </article>
      <RelatedPosts locale={locale} t={t} posts={related} />
    </div>
  );
}
