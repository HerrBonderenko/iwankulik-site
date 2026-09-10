import { SITE_URL } from "@/lib/seo";
import { getAllSlugs, getPublishedLocales, getPostMeta } from "@/lib/blog";

// Та сама причина, що й у app/sitemap.js: карта має сама підхоплювати
// статті, у яких настала дата публікації, без окремого деплою.
export const revalidate = 3600;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function blogEntries() {
  const entries = [];
  for (const slug of getAllSlugs()) {
    // Заплановані статті пропускаємо — вони віддають 404.
    for (const locale of getPublishedLocales(slug)) {
      const post = await getPostMeta(locale, slug);
      const url = `${SITE_URL}/${locale}/blog/${slug}`;
      const imageUrl = `${SITE_URL}${post.cover}`;
      entries.push(`  <url>
    <loc>${escapeXml(url)}</loc>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(`${post.title} — блог Івана Куліка`)}</image:title>
      <image:caption>${escapeXml(post.description)}</image:caption>
    </image:image>
  </url>`);
    }
  }
  return entries;
}

export async function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${(await blogEntries()).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
