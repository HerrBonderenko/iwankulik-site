"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { pick } from "@/lib/i18n";
import { formatPrice } from "@/lib/price";
import InquiryModal from "@/components/InquiryModal";

// Продана робота і робота в приватній колекції — не товар: замість дії
// показуємо статичний підпис. Пропонувати «схожу» тут не можна: сайт
// продає унікальні оригінали, а не копії на замовлення (див. блок
// «Автентичність»). Для доступних робіт текст кнопки залежить від ціни:
// «Придбати», коли ціна вже відома, інакше «Запитати ціну».
function isForSale(x) {
  return x.status === "available";
}

function statusLabel(t, x) {
  return x.status === "sold" ? t.gallery.soldLabel : t.gallery.collectionLabel;
}

function orderLabel(t, x) {
  return x.price ? t.gallery.order : t.gallery.askPrice;
}

export default function Gallery({ locale, t, paintings, email, phone }) {
  const [i, setI] = useState(0);
  const [thumbs, setThumbs] = useState(true);
  const [ask, setAsk] = useState(null);
  const touchX = useRef(null);
  const box = useRef(null);
  const n = paintings.length;
  const p = paintings[i];

  const go = useCallback((d) => setI((v) => (v + d + n) % n), [n]);

  // Повернення до сітки прибирає ?w= з адреси: інакше перезавантаження
  // сторінки (чи перехід на іншу мову) знову відкривало б переглядач.
  const backToThumbs = useCallback(() => {
    setThumbs(true);
    const url = new URL(window.location.href);
    if (url.searchParams.has("w")) {
      url.searchParams.delete("w");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);

  // Відкрити роботу в переглядачі й підвести до неї сторінку. Плавність —
  // тільки якщо людина не просила прибрати рух: scrollIntoView сам
  // prefers-reduced-motion не враховує, на відміну від CSS.
  const openPainting = useCallback((id) => {
    const k = paintings.findIndex((x) => x.id === id);
    if (k === -1) return;
    setI(k);
    setThumbs(false);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }, [paintings]);

  // Робота в адресі (?w=id) — так сюди веде пошук за номером у футері,
  // і так само працює посилання, надіслане клієнту.
  useEffect(() => {
    const readUrl = () => {
      const w = new URLSearchParams(window.location.search).get("w");
      if (w) openPainting(w);
      else setThumbs(true);
    };
    readUrl();
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, [openPainting]);

  useEffect(() => {
    // Слухач глобальний, тож стрілки з поля вводу теж доходили сюди:
    // курсор у пошуку за номером у футері або в коментарі заявки листав
    // картину замість тексту. Модалка теж забирає стрілки собі —
    // поки вона відкрита, переглядач під нею не гортаємо.
    const onKey = (e) => {
      if (ask) return;
      const el = e.target;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, ask]);

  if (thumbs) {
    return (
      // data-view — ключ і для React, і для CSS: сітка й переглядач
      // це два різні макети в одному місці, і підміна без переходу
      // читалась би як перехід на іншу сторінку.
      <div className="gallery-box" ref={box}>
        <div className="gallery-view" key="thumbs">
        <div className="thumbs">
          {paintings.map((x, k) => (
            /* id — якір для посилання на роботу з листа про заявку */
            <figure key={x.id} id={x.id} className="thumb-card">
              {/* Посилання, а не div з onClick: працює з клавіатури,
                  відкривається середньою кнопкою й у новій вкладці.
                  Звичайний лівий клік перехоплюємо — переглядач тут-таки,
                  повний перехід був би зайвим (той самий прийом, що й у
                  пошуку за номером у футері). */}
              <Link
                href={`/${locale}/zhyvopys?w=${encodeURIComponent(x.id)}`}
                className="thumb"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  window.history.pushState(null, "", `${window.location.pathname}?w=${encodeURIComponent(x.id)}`);
                  setI(k);
                  setThumbs(false);
                }}
              >
                {/* Перша мініатюра — найбільший видимий елемент сітки при
                    відкритті сторінки, тобто її LCP. Решта лишається
                    лінивою: сітка довга, вантажити все одразу ні до чого. */}
                <Image src={x.img} alt={pick(x.title, locale)} fill priority={k === 0} sizes="(max-width: 720px) 50vw, 25vw" />
                {/* Позначка тільки на вільних роботах: якщо позначити всі,
                    вона перестане щось означати. */}
                {x.status === "available" && (
                  <span className="thumb-badge">
                    <i className="dot" aria-hidden="true" />
                    {t.gallery.availableBadge}
                  </span>
                )}
              </Link>
              <figcaption className="thumb-cap">
                <span className="work-line">
                  <span className="thumb-title">{pick(x.title, locale)}</span>
                  {x.code && <span className="work-code">{x.code}</span>}
                </span>
                {x.status === "available" && (
                  x.price
                    ? <span className="painting-price">{formatPrice(x.price, locale)}</span>
                    : <span className="small muted">{t.gallery.priceOnRequest}</span>
                )}
                <span className="small muted">
                  {x.size} {"\u0441\u043c"}, {pick(x.tech, locale)}, {x.year}
                </span>
                {/* Третій рядок — дія для доступних робіт, статус для решти. */}
                {isForSale(x)
                  ? (
                    <button type="button" className="link small thumb-act" onClick={() => setAsk(x)}>
                      {orderLabel(t, x)}
                    </button>
                  )
                  : <span className="small muted thumb-act">{statusLabel(t, x)}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
        </div>
        <p style={{ textAlign: "center" }}>
          <button type="button" className="link small" onClick={() => setThumbs(false)}>{t.gallery.viewer}</button>
        </p>
        {ask && <InquiryModal t={t} locale={locale} painting={ask} email={email} phone={phone} onClose={() => setAsk(null)} />}
      </div>
    );
  }

  return (
    <div className="gallery-box" ref={box}>
      <div className="gallery-view" key="viewer">
      <div
        className="viewer"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* key за роботою: кадр проступає замість того, щоб підмінитись
            без сліду. Найкоротший перехід на сайті — гортання буває
            десятки разів поспіль, і помітний рух тут почав би заважати. */}
        <div className="viewer-img" key={p.id}>
          <Image src={p.img} alt={pick(p.title, locale)} fill priority sizes="(max-width: 800px) 100vw, 760px" />
        </div>
        <div className="viewer-caption">
          <span className="viewer-title">{pick(p.title, locale)}</span>
          {p.code && <span className="work-code">{p.code}</span>}
          {p.status === "available" && (
            p.price
              ? <span className="painting-price">{formatPrice(p.price, locale)}</span>
              : <span className="small muted">{t.gallery.priceOnRequest}</span>
          )}
          <span className="small muted">
            {p.size} {"см"}, {pick(p.tech, locale)}, {p.year}
          </span>
          {/* Статус несе окремий підпис нижче, тому в рядку розміру його нема. */}
          {isForSale(p)
            ? (
              <span className="small">
                <button type="button" className="link" onClick={() => setAsk(p)}>
                  {orderLabel(t, p)} →
                </button>
                <span className="small muted"> · {t.gallery.replyFast}</span>
              </span>
            )
            : <span className="small muted">{statusLabel(t, p)}</span>}
        </div>
        <div className="viewer-nav">
          <button type="button" className="link" onClick={() => go(-1)}>← {t.gallery.prev}</button>
          <button type="button" className="link" onClick={() => go(1)}>{t.gallery.next} →</button>
        </div>
        <div className="viewer-nums">
          {paintings.map((x, k) => (
            <button type="button" key={x.id} className={k === i ? "active" : ""} onClick={() => setI(k)}>{k + 1}</button>
          ))}
        </div>
        <button type="button" className="link small muted" onClick={backToThumbs}>{t.gallery.thumbs}</button>
      </div>
      </div>
      {ask && <InquiryModal t={t} locale={locale} painting={ask} email={email} phone={phone} onClose={() => setAsk(null)} />}
    </div>
  );
}
