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
// Cormorant лишається тільки в 300 — у globals.css кожне правило з
// var(--font-display) задає саме цю вагу. 400 і 500 оголошувалися, але
// не малювалися ніде, а next/font усе одно клав їх у <head> як
// <link rel=preload as=font> з високим пріоритетом. Разом із курсивом
// нижче це знімає з критичного шляху 136 КБ: було 8 preload на 254 КБ,
// лишилося 5 на 118 КБ (заміряно по .next/static/media після збірки).
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300"],
  variable: "--font-cormorant",
  display: "swap",
});

// Курсив Cormorant — другим викликом і навмисно без preload. Ним набрані
// лише .cycles-intro і .cycles-note, обидві нижче першого екрана, а
// preload від next/font кладе шрифт у <head> з високим пріоритетом і
// відбирає канал у героя рівно тоді, коли той вантажиться. Без preload
// браузер дійде до нього по CSS уже після LCP.
// Окремий виклик потрібен саме тому, що preload у next/font — прапорець
// на все оголошення, по style його не розділити. У CSS нічого міняти не
// довелося: обидва виклики дають ту саму родину "Cormorant Garamond", і
// font-style: italic сам вибирає накреслення звідси.
const cormorantItalic = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300"],
  style: ["italic"],
  variable: "--font-cormorant-italic",
  display: "swap",
  preload: false,
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
      generatedImage: true,
    }),
    // Підтвердження прав у Google Search Console. Стоїть тут, у макеті
    // локалі, а не в buildMetadata: метадані макета успадковують усі
    // вкладені сторінки, тож тег є скрізь під /{locale} і його не треба
    // повторювати в кожному роуті.
    verification: {
      google: "tvgSMdfWRTGmIZYm9PYx0zFLAU-xtIPNU6X2gZauF9Q",
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
    <html lang={locale} data-theme="dark" className={`${cormorant.variable} ${cormorantItalic.variable} ${archivo.variable}`} suppressHydrationWarning>
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
        <JsonLd data={personSchema(locale)} />
        <Header locale={locale} t={t} contacts={contacts} />
        <main>{children}</main>
        <Footer locale={locale} t={t} contacts={contacts} works={works} />
        <ScrollTop label={t.scrollTop} />
        {/* Аналітика Umami Cloud — без cookies, тож банер згоди не
            потрібен. Відсікання тестових заходів у два шари:
            IS_PRODUCTION_DEPLOY вшивається на збірці лише для
            продакшн-деплою (див. next.config.mjs), тож localhost і
            deploy preview скрипт навіть не отримують; data-domains
            додатково глушить його на *.netlify.app-адресах самого
            прод-деплою — Umami шле події лише з iwankulik.com.
            Адмінка має власний кореневий макет і сюди не потрапляє. */}
        {process.env.IS_PRODUCTION_DEPLOY && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id="c325a397-b6d5-4ac4-86e9-f2eb60d4880e"
            data-domains="iwankulik.com"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
