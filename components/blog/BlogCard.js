import Image from "next/image";
import Link from "next/link";
import { categoryName, categorySlug, formatDate } from "@/lib/blog";
import { coverAlt } from "@/lib/coverAlt";

export default function BlogCard({ locale, t, post }) {
  return (
    <div className="card blog-card">
      <Link href={`/${locale}/blog/${post.slug}`} className="blog-card-link">
        <div className="card-img">
          {/* Alt описує саме зображення, а не статтю: обкладинки спільні,
              див. lib/coverAlt.js. Заголовок і так поруч, у підписі картки. */}
          <Image
            src={post.cover}
            alt={coverAlt(post.cover, locale) ?? post.title}
            fill
            sizes="(max-width: 920px) 100vw, 33vw"
          />
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
