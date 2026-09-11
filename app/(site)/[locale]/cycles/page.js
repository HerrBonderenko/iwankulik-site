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
    path: "/cycles",
    title: t.seo.cycles.title,
    description: t.seo.cycles.description,
    siteName: t.name,
    generatedImage: true,
  });
}

export const revalidate = 60;

export default async function CyclesPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const { cycles } = await getData();
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.nav.cycles, path: "/cycles" },
    ],
  });

  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <section className="section" style={{ borderBottom: "none" }}>
        <h1 className="section-title">{t.nav.cycles}</h1>
        <p className="cycles-intro" style={{ marginBottom: 48 }}>{t.cycles.intro}</p>

        <div className="cycles-list">
          {cycles.map((c) => {
            const title = pick(c.title, locale);
            const note = c.countNote ? pick(c.countNote, locale) : null;
            return (
              <Link key={c.id} href={`/${locale}/cycles/${c.slug}`} className="cycle-card">
                <span className="cycle-card-img">
                  {c.img
                    ? <Image src={c.img} alt={title} fill sizes="(max-width: 920px) 100vw, 33vw" />
                    : <span className="cycle-img-empty" />}
                </span>
                <span className="cycle-card-title">{title}</span>
                {(c.count || note) && (
                  <span className="cycle-count">
                    {c.count && <span>{c.count} {t.cycles.canvases}</span>}
                    {note && <span>{note}</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
