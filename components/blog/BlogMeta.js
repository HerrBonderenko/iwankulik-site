import Image from "next/image";
import { pick } from "@/lib/i18n";
import { formatDate } from "@/lib/blog";

export default function BlogMeta({ locale, t, author, publishedAt, updatedAt, readingMinutes }) {
  return (
    <div className="blog-meta">
      {author && (
        <div className="blog-meta-author">
          <div className="blog-meta-avatar">
            {/* alt="": ім'я автора стоїть текстом одразу поруч. */}
            <Image src={author.photo} alt="" fill sizes="40px" />
          </div>
          <span>{pick(author.name, locale)}</span>
        </div>
      )}
      <span className="small muted">
        <time dateTime={publishedAt}>{t.blog.publishedOn} {formatDate(publishedAt, locale)}</time>
        {updatedAt && updatedAt !== publishedAt && (
          <> · <time dateTime={updatedAt}>{t.blog.updatedOn} {formatDate(updatedAt, locale)}</time></>
        )}
      </span>
      <span className="small muted">{readingMinutes} {t.blog.minRead}</span>
    </div>
  );
}
