import Link from "next/link";
import { getDict, locales } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { getAllPosts, CATEGORY_KEYS, categoryName, categorySlug } from "@/lib/blog";
import JsonLd from "@/components/JsonLd";
import BlogCard from "@/components/blog/BlogCard";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return buildMetadata({
    locale,
    path: "/blog",
    title: t.seo.blog.title,
    description: t.seo.blog.description,
    siteName: t.name,
  });
}

export const revalidate = 60;

export default async function BlogPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const posts = await getAllPosts(locale);

  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.blog.title, path: "/blog" },
    ],
  });
  const collection = collectionPageSchema({
    locale,
    path: "/blog",
    name: t.seo.blog.title,
    description: t.seo.blog.description,
    items: posts.map((p) => ({ img: p.cover, name: p.title })),
  });

  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <JsonLd data={collection} />
      <section className="section" style={{ borderBottom: "none" }}>
        <h1 className="section-title">{t.blog.title}</h1>

        <div className="filter blog-categories">
          <Link href={`/${locale}/blog`} className="active">
            {t.blog.categoryAll}
          </Link>
          {CATEGORY_KEYS.map((key) => (
            <Link key={key} href={`/${locale}/blog/${categorySlug(key, locale)}`}>
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
