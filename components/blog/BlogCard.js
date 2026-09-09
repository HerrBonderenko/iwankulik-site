import Image from "next/image";
import Link from "next/link";
import { categoryName, categorySlug, formatDate } from "@/lib/blog";

export default function BlogCard({ locale, t, post }) {
  return (
    <div className="card blog-card">
      <Link href={`/${locale}/blog/${post.slug}`} className="blog-card-link">
        <div className="card-img">
          <Image src={post.cover} alt={post.title} fill sizes="(max-width: 920px) 100vw, 33vw" />
        </div>
        <span className="card-caption blog-card-title">{post.title}</span>
      </Link>
      <Link href={`/${locale}/blog/${categorySlug(post.category, locale)}`} className="blog-card-category">
        {categoryName(post.category, locale)}
      </Link>
      <p className="small muted blog-card-desc">{post.description}</p>
      <p className="small muted blog-card-meta">
        {formatDate(post.publishedAt, locale)} · {post.readingMinutes} {t.blog.minRead}
      </p>
    </div>
  );
}
