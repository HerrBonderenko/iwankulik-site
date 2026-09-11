import { getDict, locales } from "@/lib/i18n";
import {
  CATEGORY_KEYS,
  categoryKeyFromSlug,
  categoryName,
  categorySlug,
  getPostMeta,
  getPostSlugs,
  isPublished,
  isPublishedSlug,
} from "@/lib/blog";
import { OG_ALT, OG_CONTENT_TYPE, OG_NEUTRAL_BG, OG_SIZE, ogNotFound, renderOgImage } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 60;

// Той самий набір, що в page.js поруч: категорії й уже опубліковані статті.
// Заплановану статтю картинка теж не випереджає — до дати вона 404.
export function generateStaticParams() {
  const params = [];
  for (const locale of locales) {
    for (const key of CATEGORY_KEYS) params.push({ locale, slug: categorySlug(key, locale) });
    for (const slug of getPostSlugs(locale)) {
      if (isPublishedSlug(locale, slug)) params.push({ locale, slug });
    }
  }
  return params;
}

// [slug] тут, як і в page.js, — або категорія, або стаття.
export default async function Image({ params }) {
  const { locale, slug } = await params;
  if (!locales.includes(locale)) return ogNotFound();
  const t = getDict(locale);

  const categoryKey = categoryKeyFromSlug(locale, slug);
  if (categoryKey) {
    return renderOgImage({
      eyebrow: t.blog.title,
      title: categoryName(categoryKey, locale),
      name: t.name,
      background: OG_NEUTRAL_BG,
    });
  }

  const post = await getPostMeta(locale, slug);
  if (!post || !isPublished(post)) return ogNotFound();
  const category = post.category ? categoryName(post.category, locale) : "";
  return renderOgImage({
    eyebrow: category ? `${t.blog.title} · ${category}` : t.blog.title,
    title: post.title,
    name: t.name,
    // Обкладинка статті (з адмінки або з frontmatter) — та сама, що на сторінці.
    background: post.cover || OG_NEUTRAL_BG,
  });
}
