import Image from "next/image";
import Link from "next/link";
import { getDict, locales, pick } from "@/lib/i18n";
import { getData } from "@/lib/store";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return buildMetadata({
    locale,
    path: "/pro-mene",
    title: t.seo.about.title,
    description: t.seo.about.description,
    siteName: t.name,
  });
}

export const revalidate = 60;

export default async function AboutPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const { about } = await getData();
  // Текст редагується в адмінці одним полем: порожній рядок
  // між абзацами і є поділом на абзаци.
  const paragraphs = pick(about.text, locale).split(/\n\s*\n/).filter(Boolean);
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.nav.about, path: "/pro-mene" },
    ],
  });
  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      {/* Дві колонки: портрет ліворуч фіксованою шириною, весь текст
          праворуч. Ширину рядка тепер тримає .about-text, а не обгортка
          навколо всієї секції. */}
      <div className="about-layout">
        <div className="about-media">
          <div className="about-photo">
            {about.img && (
              <Image src={about.img} alt={t.name} fill sizes="(max-width: 920px) 100vw, 470px" />
            )}
          </div>
          <div className="about-photo-caption">{t.about.photoCaption}</div>
        </div>

        <div className="about-body">
          <h1>{t.name}</h1>
          <div className="about-text">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <div className="facts">
            {["f1", "f2", "f3", "f4", "f5", "f6"].map((k) => (
              <div key={k} className="fact">
                <div className="fact-num">{t.about.facts[k].num}</div>
                <div className="fact-text">{t.about.facts[k].text}</div>
              </div>
            ))}
          </div>

          <Link href={`/${locale}/zhyvopys`} className="about-cta">{t.about.ctaWorks}</Link>
        </div>
      </div>
    </div>
  );
}
