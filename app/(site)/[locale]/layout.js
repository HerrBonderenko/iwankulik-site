import { Cormorant_Garamond, Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import "@/app/globals.css";
import { locales, getDict } from "@/lib/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getData } from "@/lib/store";
import { buildWorkIndex } from "@/lib/workCodes";
import ScrollTop from "@/components/ScrollTop";
import JsonLd from "@/components/JsonLd";
import { SITE_URL, buildMetadata } from "@/lib/seo";
import { personSchema } from "@/lib/schema";

// Заголовки — Cormorant Garamond, текст — Archivo. Змінні названі за
// гарнітурою, а не за роллю: --font-display/--font-body збирає з них
// globals.css разом із фолбеками (var(--font-display) не може посилатися
// сам на себе — :root і <html> це один елемент, вийшов би цикл).
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-archivo",
  display: "swap",
});

export const revalidate = 60;

// Колір рамки браузера навколо сторінки. Значення — рівно ті самі --bg,
// що в globals.css: #171614 у темній темі, #FDFBF7 у світлій.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#171614" },
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    metadataBase: new URL(SITE_URL),
    ...buildMetadata({
      locale,
      path: "",
      title: t.seo.home.title,
      description: t.seo.home.description,
      siteName: t.name,
    }),
    // Підтвердження прав у Google Search Console. Стоїть тут, у макеті
    // локалі, а не в buildMetadata: метадані макета успадковують усі
    // вкладені сторінки, тож тег є скрізь під /{locale} і його не треба
    // повторювати в кожному роуті. Масив — два токени (дві властивості
    // в Search Console), Next віддає їх двома окремими <meta>.
    verification: {
      google: [
        "YR2TlRdCig99_RtObyJcYCE5o4OUr2cieu3riutlp8g",
        "tvgSMdfWRTGmIZYm9PYx0zFLAU-xtIPNU6X2gZauF9Q",
      ],
    },
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const t = getDict(locale);
  const { contacts, paintings } = await getData();
  // Індекс для пошуку за номером у футері: продиктована К-001 має
  // знаходитись із будь-якої сторінки.
  const works = buildWorkIndex({ paintings });
  return (
    <html lang={locale} data-theme="dark" className={`${cormorant.variable} ${archivo.variable}`} suppressHydrationWarning>
      <body>
        {/* Тема ставиться до першої відмальовки, інакше сторінка
            блимне темним перед тим, як застосується збережений
            світлий вибір. prefers-color-scheme навмисно не читаємо:
            темний фон тут — рішення дизайну, а не системи. */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var s = localStorage.getItem("theme");
            document.documentElement.setAttribute("data-theme", s === "light" ? "light" : "dark");
          } catch (e) {
            document.documentElement.setAttribute("data-theme", "dark");
          }
        `}</Script>
        <JsonLd data={personSchema()} />
        <Header locale={locale} t={t} contacts={contacts} />
        <main>{children}</main>
        <Footer locale={locale} t={t} contacts={contacts} works={works} />
        <ScrollTop label={t.scrollTop} />
      </body>
    </html>
  );
}
