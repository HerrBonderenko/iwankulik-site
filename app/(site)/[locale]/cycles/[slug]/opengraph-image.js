import { getDict, locales, pick } from "@/lib/i18n";
import { getData } from "@/lib/store";
import { cycles as staticCycles } from "@/data/site";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, ogNotFound, renderOgImage } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 60;

// Той самий набір, що в page.js поруч: слаги зі статичного описника.
export function generateStaticParams() {
  return locales.flatMap((locale) => staticCycles.map((c) => ({ locale, slug: c.slug })));
}

// Назва циклу й фото — з того самого запису, з якого page.js бере title
// для generateMetadata (сховище, а за його відсутності — описник).
export default async function Image({ params }) {
  const { locale, slug } = await params;
  if (!locales.includes(locale)) return ogNotFound();
  const { cycles } = await getData();
  const cycle = cycles.find((c) => c.slug === slug) || staticCycles.find((c) => c.slug === slug);
  if (!cycle) return ogNotFound();
  const t = getDict(locale);
  return renderOgImage({
    eyebrow: t.nav.cycles,
    title: pick(cycle.title, locale),
    name: t.name,
    background: cycle.img,
  });
}
