"use client";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales } from "@/lib/i18n";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/* Вміст сторінки 404.
   Клієнтський, бо мову тут можна дізнатися лише з адреси: not-found.js не
   отримує params, а зробити сторінку динамічною (щоб прочитати адресу із
   заголовка проксі) не можна — тоді Next перестає віддавати її маршрутам
   із dynamicParams: false і повертає вбудовану заглушку. Перевірено обидва
   варіанти; цей покриває всі 404, ціною короткої миті української мови
   до гідратації. */

// Заздалегідь відмальований HTML не знає адреси, браузер — знає.
// useSyncExternalStore дає різні знімки для сервера й клієнта штатно,
// без setState в ефекті й без розбіжності гідратації.
const noop = () => () => {};
const onClient = () => true;
const onServer = () => false;

export default function NotFoundPage({ dicts, contacts, works }) {
  const hydrated = useSyncExternalStore(noop, onClient, onServer);
  const pathname = usePathname() || "";
  const first = pathname.split("/")[1];
  // Адреса могла й не містити мови (/blog/щось) — тоді українська.
  const locale = hydrated && locales.includes(first) ? first : "uk";
  const t = dicts[locale] ?? dicts.uk;

  useEffect(() => {
    // lang на <html> ставить кореневий макет сайту, але сюди він не діє.
    document.documentElement.lang = locale;
    // Заголовок у metadata український — сервер мови не знає. Тут вона вже
    // відома з адреси, тож уточнюємо (сторінка noindex, це для вкладки,
    // історії й закладок, не для пошуковика).
    document.title = `${t.notFound.title} — ${t.name}`;
  }, [locale, t]);

  return (
    <>
      <Header locale={locale} t={t} contacts={contacts} />
      <main>
        <div className="container">
          <section className="section not-found" style={{ borderBottom: "none" }}>
            <span className="not-found-code" aria-hidden="true">404</span>
            <h1 className="section-title">{t.notFound.title}</h1>
            <p className="muted not-found-text">{t.notFound.text}</p>
            <nav className="not-found-links">
              <Link href={`/${locale}`}>{t.notFound.home}</Link>
              <Link href={`/${locale}/zhyvopys`}>{t.notFound.works}</Link>
              <Link href={`/${locale}/blog`}>{t.notFound.blog}</Link>
            </nav>
          </section>
        </div>
      </main>
      <Footer locale={locale} t={t} contacts={contacts} works={works} />
    </>
  );
}
