import { getDict, locales } from "@/lib/i18n";
import { getData } from "@/lib/store";
import OrderForm from "@/components/OrderForm";
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
    path: "/kontakty",
    title: t.seo.contacts.title,
    description: t.seo.contacts.description,
    siteName: t.name,
    generatedImage: true,
  });
}

export const revalidate = 60;

export default async function ContactsPage({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const { contacts } = await getData();
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.nav.contacts, path: "/kontakty" },
    ],
  });
  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <section className="section" style={{ borderBottom: "none", maxWidth: 520 }}>
        <h1 className="section-title">{t.contacts.title}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>{t.contacts.sub}</p>
        <div className="small" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
          {contacts.phone && (
            <a className="link" href={`tel:${contacts.phone.replace(/\s/g, "")}`}>{contacts.phone}</a>
          )}
          <a className="link" href={`mailto:${contacts.email}`}>{contacts.email}</a>
          {contacts.instagram && (
            <a className="link" href={contacts.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          )}
        </div>
        <OrderForm t={t} email={contacts.email} phone={contacts.phone} />
      </section>
    </div>
  );
}
