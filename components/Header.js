"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { locales } from "@/lib/i18n";
import { switchLocalePath } from "@/lib/localePath";
import { useDialog } from "@/lib/useDialog";
import { useExitTransition } from "@/lib/useExitTransition";
import ThemeToggle from "@/components/ThemeToggle";

function rememberLocale(l) {
  document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
  try {
    sessionStorage.setItem("scrollY", String(window.scrollY));
  } catch (e) {}
}

export default function Header({ locale, t, contacts }) {
  // open — логічний стан меню, closing — панель ще в DOM, але вже їде.
  // 240 мс збігається з тривалістю в .mobile-menu.
  const { open, mounted: menuMounted, closing: menuClosing, show: openMenu, hide: closeMenu } =
    useExitTransition(240);
  const pathname = usePathname();
  // ?w=… і #якір у href мови. usePathname їх не віддає, а
  // useSearchParams у шапці змусив би кожну сторінку сайту рендеритись
  // динамічно. Тому беремо з location вже після гідратації: на сервері
  // суфікс порожній в обох випадках, тож розбіжності нема.
  const [suffix, setSuffix] = useState("");

  useEffect(() => {
    const read = () => setSuffix(window.location.search + window.location.hash);
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, [pathname]);

  // Escape, пастка Tab, повернення фокуса на бургер і блокування
  // прокрутки фону — спільний хук із модалкою заявки.
  const menu = useDialog(open, closeMenu);

  // «Доступні роботи» тут нема: головна дія сайту — не пункт серед
  // шести інших, а кнопка праворуч (див. .header-cta нижче).
  const links = [
    { href: `/${locale}#cycles`, label: t.nav.cycles },
    { href: `/${locale}#authenticity`, label: t.nav.authenticity },
    { href: `/${locale}/pro-mene`, label: t.nav.about },
    { href: `/${locale}/blog`, label: t.nav.blog },
    { href: `/${locale}/kontakty`, label: t.nav.contacts },
  ];

  // Перемикання мови — це повний перехід на іншу адресу, тож браузер
  // починає сторінку згори. Запам'ятовуємо позицію і повертаємось на неї.
  useEffect(() => {
    let y;
    try {
      y = sessionStorage.getItem("scrollY");
      sessionStorage.removeItem("scrollY");
    } catch (e) {}
    if (!y) return;

    const top = parseInt(y, 10);
    if (!top) return;

    document.documentElement.classList.add("restoring-scroll");
    const restore = () => window.scrollTo(0, top);
    requestAnimationFrame(() => requestAnimationFrame(restore));
    // Картинки можуть підвантажитись пізніше і зсунути висоту — повторюємо.
    window.addEventListener("load", restore, { once: true });
    const t = setTimeout(() => {
      restore();
      document.documentElement.classList.remove("restoring-scroll");
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // pointerdown спрацьовує і перед середнім кліком, і перед контекстним
  // меню — так «відкрити в новій вкладці» бере свіжу адресу, навіть
  // якщо ?w= змінили через pushState (пошук за номером, галерея).
  const refreshSuffix = () => setSuffix(window.location.search + window.location.hash);

  const langs = (
    <span className="langs" onPointerDown={refreshSuffix}>
      {locales.map((l) => (
        <a
          key={l}
          href={`${switchLocalePath(pathname, locale, l)}${suffix}`}
          className={l === locale ? "active" : ""}
          onClick={() => rememberLocale(l)}
          lang={l}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </span>
  );

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href={`/${locale}`} className="logo">{t.name}</Link>
        <nav className="nav">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          {contacts.phone && (
          <a className="header-phone" href={`tel:${contacts.phone.replace(/\s/g, "")}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {contacts.phone}
          </a>
          )}
          <Link href={`/${locale}/zhyvopys`} className="header-cta">{t.cta.choosePainting}</Link>
          {langs}
          <ThemeToggle t={t} />
        </nav>
        <div className="mobile-actions">
          <ThemeToggle t={t} />
          <button
            type="button"
            className="burger"
            onClick={openMenu}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {t.menu}
          </button>
        </div>
      </div>
      {menuMounted && (
        /* Клік по тлу меню (не по пункту) закриває його: сама панель
           розтягнута на весь екран, тож «повз меню» — це порожнє місце
           в ньому самому, а не за його межами. */
        <div
          id="mobile-menu"
          className="mobile-menu"
          data-closing={menuClosing}
          role="dialog"
          aria-modal="true"
          aria-label={t.menu}
          tabIndex={-1}
          ref={menu}
          onClick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}
        >
          <div className="top">
            <Link href={`/${locale}`} className="logo" onClick={closeMenu}>{t.name}</Link>
            <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {/* Меню перекриває шапку (z-index 100 проти 50), тож без
                  власної копії перемикач теми був би недоступний. */}
              <ThemeToggle t={t} />
              <button type="button" onClick={closeMenu}>{t.form.close}</button>
            </span>
          </div>
          {/* Мобільна копія кнопки з шапки — той самий ключ, що й у неї
              та в героя: одна дія, один підпис на всіх трьох. */}
          <Link
            href={`/${locale}/zhyvopys`}
            className="mobile-menu-cta"
            onClick={closeMenu}
          >
            {t.cta.choosePainting}
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={closeMenu}>{l.label}</Link>
          ))}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }} className="small">
            {contacts.phone && <a href={`tel:${contacts.phone.replace(/\s/g, "")}`}>{contacts.phone}</a>}
            <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            {contacts.instagram && (
              <a href={contacts.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            )}
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {langs}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
