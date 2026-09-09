import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDict, locales, pick, interpolate } from "@/lib/i18n";
import { getData } from "@/lib/store";
import { cycles as staticCycles } from "@/data/site";
import { buildMetadata, leadSentence } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

// Слаги беремо зі статичного описника, а не зі сховища: склад циклів
// сталий (адмінка редагує вміст, але не список), тож набір маршрутів
// відомий на збірці й не залежить від того, що зараз лежить у блобі.
export function generateStaticParams() {
  return locales.flatMap((locale) => staticCycles.map((c) => ({ locale, slug: c.slug })));
}

async function findCycle(slug) {
  const { cycles } = await getData();
  return cycles.find((c) => c.slug === slug) || staticCycles.find((c) => c.slug === slug) || null;
}

// pick() на порожньому {} віддає undefined (немає ні locale, ні en, ні uk),
// тож текст завжди проганяємо через цю обгортку — і на сторінці, і в
// метаданих. Порожній текст — робочий стан: його можна стерти в адмінці.
function cycleText(cycle, locale) {
  const field = cycle.text;
  if (!field || typeof field !== "object") return "";
  return pick(field, locale) || "";
}

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const t = getDict(locale);
  const cycle = await findCycle(slug);
  if (!cycle) return {};
  const title = pick(cycle.title, locale);
  // Опис — перше речення тексту циклу. Шаблон seo.cycles.itemDescription
  // лишається запасним: він потрібен, поки текст порожній.
  const lead = leadSentence(cycleText(cycle, locale));
  return buildMetadata({
    locale,
    path: `/cycles/${slug}`,
    title: `${title} — ${t.name}`,
    description: lead || interpolate(t.seo.cycles.itemDescription, { title }),
    siteName: t.name,
  });
}

// dynamicParams тут навмисно НЕ вимкнено, хоч набір слагів і відомий
// на збірці. З dynamicParams: false Netlify віддавав 404 на всі
// вкладені динамічні маршрути: пререндерену сторінку рантайм не
// знаходив, а зібрати її на льоту флаг забороняв.
//
// Зі значенням за замовчуванням (true) невідомий слаг доходить до
// notFound() у самій сторінці, і на Netlify це малює нашу 404 цілком —
// із шапкою, футером і посиланнями, мовою локалі (перевірено на
// /ru/cycles/abcdef живого сайту).
//
// Локальний next start поводиться інакше: там та сама гілка віддає
// порожнє тіло в оболонці <html id="__next_error__"> повз макет (site).
// Це розбіжність середовищ, а не поведінка проду — межі not-found і
// оболонку перевіряти лише на деплої (див. CLAUDE.md).

export const revalidate = 60;

export default async function CyclePage({ params }) {
  const { locale, slug } = await params;
  const t = getDict(locale);
  const cycle = await findCycle(slug);
  if (!cycle) notFound();

  const title = pick(cycle.title, locale);
  const note = cycle.countNote ? pick(cycle.countNote, locale) : null;
  // Текст редагується одним полем на локаль: порожній рядок між
  // рядками і є поділом на абзаци — так само, як на сторінці «Про мене».
  const paragraphs = cycleText(cycle, locale).split(/\n\s*\n/).filter(Boolean);
  const breadcrumb = breadcrumbSchema({
    locale,
    crumbs: [
      { name: t.nav.home, path: "" },
      { name: t.nav.cycles, path: "/cycles" },
      { name: title, path: `/cycles/${slug}` },
    ],
  });

  return (
    <div className="container">
      <JsonLd data={breadcrumb} />
      <section className="section" style={{ borderBottom: "none" }}>
        <p className="label" style={{ marginBottom: 18 }}>
          <Link href={`/${locale}/cycles`}>{t.nav.cycles}</Link>
        </p>
        <h1 className="section-title" style={{ marginBottom: 16 }}>{title}</h1>
        {(cycle.count || note) && (
          <span className="cycle-count" style={{ marginTop: 0, marginBottom: 32 }}>
            {cycle.count && <span>{cycle.count} {t.cycles.canvases}</span>}
            {note && <span>{note}</span>}
          </span>
        )}

        {cycle.img && (
          <div className="cycle-hero">
            <Image src={cycle.img} alt={title} fill sizes="(max-width: 920px) 100vw, 900px" />
          </div>
        )}

        {paragraphs.length > 0 && (
          <div className="cycle-body">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            {/* Той самий підпис, що й під текстом «Про мене»: обидві
                сторінки читають про роботи й ведуть в одне місце. */}
            <Link href={`/${locale}/zhyvopys`} className="about-cta">{t.about.ctaWorks}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
