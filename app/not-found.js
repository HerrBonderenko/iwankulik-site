import { Cormorant_Garamond, Archivo } from "next/font/google";
import "@/app/globals.css";
import { locales, getDict } from "@/lib/i18n";
import { getData } from "@/lib/store";
import { buildWorkIndex } from "@/lib/workCodes";
import NotFoundPage from "@/components/NotFoundPage";

// Своя 404 замість вбудованої заглушки Next: та йшла англійською, без
// шапки, футера й жодного посилання — з неї не було куди піти.
//
// Файл лежить у корені app/, а не в (site)/[locale]/: у застосунку два
// кореневі макети ((site) і (admin)) і жодного спільного над ними, тож
// власної межі not-found у групи (site) бути не може. Локальна перевірка
// вкладеної межі ([locale]/not-found.js, blog/[slug]/not-found.js,
// experimental global-not-found.js) показала, що роутер її підхоплює й
// віддає 404, але малює в оболонці <html id="__next_error__"> повз макет
// (site) — тобто з порожнім тілом. Сюди ж, у корінь, лишається єдиний
// надійний шлях.
//
// Сюди потрапляють адреси, які не збіглися з жодним маршрутом. Невідомі
// слаги статей і циклів ідуть іншою дорогою — через notFound() у самій
// сторінці (dynamicParams там більше не вимкнено, див. коментар у
// cycles/[slug]/page.js); на проді Netlify малює для них цю саму 404.
//
// Кореневий макет для цього файлу Next генерує сам, тож шрифти, тему й
// стилі підключаємо тут.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500"],
  variable: "--font-cormorant",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-archivo",
  display: "swap",
});

// Лише те, що справді читають шапка, футер і сам блок 404 — цілі словники
// всіх п'яти мов у клієнтський бандл тягнути ні до чого.
function shell(locale) {
  const d = getDict(locale);
  return {
    name: d.name,
    menu: d.menu,
    theme: d.theme,
    themeLight: d.themeLight,
    themeDark: d.themeDark,
    nav: d.nav,
    // Кнопка в шапці й у мобільному меню — той самий ключ, що й у героя.
    cta: d.cta,
    form: { close: d.form.close },
    footer: d.footer,
    search: d.search,
    notFound: d.notFound,
  };
}

const dicts = Object.fromEntries(locales.map((l) => [l, shell(l)]));

// Мову цієї сторінки сервер не знає: not-found.js не отримує params, а
// зробити її динамічною не можна (див. коментар угорі). Тому в розмітку
// йде українська, а клієнт уточнює заголовок і lang за адресою —
// скриптом нижче ще до першої відмальовки й ефектом у NotFoundPage.
const UK = getDict("uk");

export const metadata = {
  title: `${UK.notFound.title} — ${UK.name}`,
  description: UK.notFound.text,
  // Next і сам ставить noindex на not-found, але власний metadata його
  // перекриває — тож повторюємо явно.
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#171614" },
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
  ],
};

export default async function NotFound() {
  const { contacts, paintings } = await getData();
  // --font-display / --font-body оголошені в :root, а самі
  // --font-cormorant / --font-archivo приходять класами сюди. var() усередині
  // кастомної властивості резолвиться там, де її оголошено, тож у :root вони
  // порожні й лишався б Georgia. Оголошуємо пару ще раз — поруч зі шрифтами.
  return (
    <div
      data-theme="dark"
      // Тему обирає скрипт нижче, ще до першої відмальовки, і React про це
      // не знає — саме випадок для suppressHydrationWarning. Атрибут стоїть
      // на обгортці, а не на <html>: цей кореневий макет генерує Next, ми
      // його не рендеримо й погасити попередження там не можемо. Селектори
      // тем у globals.css — атрибутні, тож працюють на будь-якому елементі.
      suppressHydrationWarning
      className={`${cormorant.variable} ${archivo.variable}`}
      style={{
        "--font-display": "var(--font-cormorant), Georgia, serif",
        "--font-body": "var(--font-archivo), system-ui, sans-serif",
        // body вище за цю обгортку: і його фон, і шрифт рахувались би від
        // токенів, яких там ще нема. Тому фон і текст задаємо тут.
        fontFamily: "var(--font-archivo), system-ui, sans-serif",
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
      }}
    >
      {/* Другий блок скрипта — lang на <html>. У розмітці його нема зовсім:
          кореневий макет для цієї сторінки генерує Next, ми його не
          рендеримо. Ставимо тут, до першої відмальовки, за першим сегментом
          адреси; ефект у NotFoundPage потім лише підтверджує це значення. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var e=document.currentScript.parentElement;try{var s=localStorage.getItem("theme");e.setAttribute("data-theme",s==="light"?"light":"dark")}catch(x){e.setAttribute("data-theme","dark")}try{var l=location.pathname.split("/")[1];document.documentElement.lang=${JSON.stringify(locales)}.indexOf(l)>-1?l:"uk"}catch(x){}})()`,
        }}
      />
      <NotFoundPage dicts={dicts} contacts={contacts} works={buildWorkIndex({ paintings })} />
    </div>
  );
}
