import { getDict, locales } from "@/lib/i18n";
import { getData } from "@/lib/store";
import { hero as staticHero } from "@/data/site";
import { ogHeadline } from "@/lib/seo";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, ogNotFound, renderOgImage } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Та сама частота, що й у сторінок: назви й фото редагуються в адмінці й
// живуть у сховищі. Між оновленнями картинка віддається з кешу — краулер
// соцмережі її не перезбирає.
export const revalidate = 60;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Головна: ім'я художника великим, під ним — решта seo.home.title
// («олійний живопис»); фон — той самий кадр, що в героя сторінки.
export default async function Image({ params }) {
  const { locale } = await params;
  if (!locales.includes(locale)) return ogNotFound();
  const t = getDict(locale);
  const { hero } = await getData();
  const eyebrow = ogHeadline(t.seo.home.title, t.name);
  return renderOgImage({
    eyebrow: eyebrow === t.seo.home.title ? "" : eyebrow,
    title: t.name,
    background: hero?.img || staticHero.img,
  });
}
