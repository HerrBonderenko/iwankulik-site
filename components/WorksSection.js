"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { pick, interpolate } from "@/lib/i18n";
import { formatPrice, normalizePrice } from "@/lib/price";

/* Секція «Доступні роботи» на головній.
   Клієнтська, бо фільтр за циклом перемикається без переходу на сервер.

   Сітка — CSS columns: роботи різних пропорцій (100×140 і 140×100)
   у рівній сітці або обрізались би, або лишали діри. Пропорції кадру
   беремо не з файлу, а з розміру полотна («100 × 140» → 100/140):
   так висота відома ще до завантаження зображення й сітка не стрибає. */

// «100 × 140» / «100x140» → "100 / 140". Невідомий формат — 4/3, як було.
function aspectFromSize(size) {
  const m = String(size || "").match(/(\d+(?:[.,]\d+)?)\s*[×xX]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return "4 / 3";
  const w = parseFloat(m[1].replace(",", "."));
  const h = parseFloat(m[2].replace(",", "."));
  if (!w || !h) return "4 / 3";
  return `${w} / ${h}`;
}

export default function WorksSection({ locale, t, paintings, cycles, homeCount }) {
  const [filter, setFilter] = useState("all");

  // Кнопку показуємо лише для циклу, у якому є хоч одна доступна робота:
  // порожній фільтр — обіцянка, яку нема чим виконати.
  const usedCycles = useMemo(() => {
    const withWorks = new Set(
      paintings.filter((p) => p.status === "available" && p.cycle).map((p) => p.cycle)
    );
    return cycles.filter((c) => withWorks.has(c.id));
  }, [paintings, cycles]);

  // На головній показуємо не весь каталог, а перші homeCount робіт
  // поточного фільтра — решта чекає в галереї.
  const shown = useMemo(() => {
    const list = filter === "all" ? paintings : paintings.filter((p) => p.cycle === filter);
    return list.slice(0, homeCount);
  }, [paintings, filter, homeCount]);

  const range = useMemo(() => {
    const nums = paintings
      .filter((p) => p.status === "available")
      .map((p) => Number(normalizePrice(p.price).replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return { min, max, same: min === max };
  }, [paintings]);

  return (
    <section className="section works-section">
      <div className="works-head">
        <div className="works-head-left">
          <h2 className="works-title">{t.home.paintingsTitle}</h2>
          {/* Скільки робіт показано — у підвалі секції; тут лише про те,
              що це оригінали з майстерні. */}
          <div className="works-sub">{t.home.priceNote}</div>
        </div>

        <div className="works-head-right">
          {usedCycles.length > 0 && (
            <div className="works-filters">
              <button
                type="button"
                className={filter === "all" ? "works-filter is-active" : "works-filter"}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                {t.home.filterAll}
              </button>
              {usedCycles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={filter === c.id ? "works-filter is-active" : "works-filter"}
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(c.id)}
                >
                  {pick(c.title, locale)}
                </button>
              ))}
            </div>
          )}
          {range && (
            <span className="works-range">
              {range.same
                ? formatPrice(range.min, locale)
                : `${formatPrice(range.min, locale)} — ${formatPrice(range.max, locale)}`}
            </span>
          )}
        </div>
      </div>

      {/* key за фільтром: React перемонтовує сітку, і вона проступає
          заново (.works-grid у globals.css). Без цього набір карток
          підмінявся б миттєво, і зв'язок «натиснув — змінилось»
          доводилось би відновлювати самому. */}
      <div className="works-grid" key={filter}>
        {shown.map((p) => {
          const title = pick(p.title, locale);
          const price = formatPrice(p.price, locale);
          const forSale = p.status === "available";
          return (
            <Link
              key={p.id}
              href={`/${locale}/zhyvopys?w=${encodeURIComponent(p.id)}`}
              className={forSale ? "works-card" : "works-card is-dim"}
            >
              <span className="works-card-media" style={{ aspectRatio: aspectFromSize(p.size) }}>
                {/* alt="": назва роботи стоїть текстом у цьому ж посиланні. */}
                <Image src={p.img} alt="" fill sizes="(max-width: 560px) 100vw, (max-width: 920px) 50vw, 33vw" />
                {forSale && (
                  <span className="thumb-badge">
                    <i className="dot" aria-hidden="true" />
                    {t.gallery.availableBadge}
                  </span>
                )}
              </span>
              <span className="works-card-cap">
                <span className="works-card-line">
                  <span className="works-card-title">{title}</span>
                  {price && <span className="works-card-price">{price}</span>}
                </span>
                <span className="works-card-meta">
                  {pick(p.tech, locale)} · {p.size} см · {p.year}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="works-foot">
        <span>{interpolate(t.home.worksShown, { shown: shown.length, total: paintings.length })}</span>
        <Link href={`/${locale}/zhyvopys`}>{t.home.allPaintings}</Link>
      </div>
    </section>
  );
}
