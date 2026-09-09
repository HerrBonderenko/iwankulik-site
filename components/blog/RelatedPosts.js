import BlogCard from "@/components/blog/BlogCard";

export default function RelatedPosts({ locale, t, posts }) {
  if (!posts || posts.length === 0) return null;
  return (
    <section className="section blog-related">
      <h2 className="section-title">{t.blog.related}</h2>
      <div className="grid-3">
        {posts.map((post) => (
          <BlogCard key={post.slug} locale={locale} t={t} post={post} />
        ))}
      </div>
    </section>
  );
}
