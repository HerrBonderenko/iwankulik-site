import { getDict, locales, pick } from "@/lib/i18n";
import Gallery from "@/components/Gallery";
import { getData } from "@/lib/store";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import { collectionPageSchema, breadcrumbSchema, productSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return buildMetadata({
    locale,
    path: "/zhyvopys",
    title: t.seo.paintings.title,
    description: t.seo.paintings.description,
    siteName: t.name,
    image: { url: `${SITE_URL}/og/zhyvopys.jpg` },
  });
}

export const revalidate = 60;

export default async function PaintingsPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const { paintings, contacts } = await getData();
  const schema = collectionPageSchema({
    locale,
    path: "/zhyvopys",
    name: t.seo.paintings.title,
    description: t.seo.paintings.description,
    items: paintings.map((p) => ({ img: p.img, name: pick(p.title, locale) })),
  });
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.nav.paintings, path: "/zhyvopys" },
    ],
  });
  return (
    <div className="container">
      <JsonLd data={schema} />
      <JsonLd data={breadcrumb} />
      {/* Кожна робота — окремий Product: пошуковики бачать не фотогалерею,
          а каталог речей із ціною й наявністю. */}
      {paintings.map((p) => (
        <JsonLd key={p.id} data={productSchema(p, locale)} />
      ))}
      <section className="section" style={{ borderBottom: "none" }}>
        <h1 className="section-title">{t.gallery.title}</h1>
        <Gallery locale={locale} t={t} paintings={paintings} email={contacts.email} phone={contacts.phone} />
      </section>
    </div>
  );
}
