import Image from "next/image";
import Link from "next/link";
import { pick } from "@/lib/i18n";

// Розкладка рядків: у якій колонці кадр, у якій — назва. Тримаємо
// таблицею поруч із розміткою, а не п'ятьма :nth-child у CSS — так видно
// весь ритм секції одним поглядом.
//
// Накладання назви на кадр прибрано. На сайті дві теми, і колір тексту в
// них протилежний, тож підкласти під нього затемнення так, щоб працювало
// в обох, неможливо: замір показав, що градієнт, який рятував темну тему,
// у світлій опускав контраст назви з 13:1 до 1.4:1. Тепер кадр займає
// рівно свою колонку, а текст стоїть у сусідній, на тлі сторінки.
//
// text.align — текст «дивиться» на кадр: коли він праворуч від
// зображення, вирівнюється по лівому краю, і навпаки.
const ROWS = [
  { img: { col: 1, aspect: "16 / 10" }, text: { col: 2, align: "left" } },
  { img: { col: 2, aspect: "4 / 3" },   text: { col: 1, align: "right" } },
  { img: { col: 1, aspect: "4 / 3" },   text: { col: 2, align: "left" } },
  { img: { col: 2, aspect: "4 / 3" },   text: { col: 1, align: "right" } },
  { img: { col: 1, aspect: "4 / 3" },   text: { col: 2, align: "left" } },
];

export default function CyclesSection({ locale, t, cycles }) {
  return (
    <section className="section" id="cycles">
      <div className="cycles-head">
        <p className="cycles-intro">{t.cycles.intro}</p>
        <span className="cycles-meta label">{t.cycles.meta}</span>
      </div>

      <div className="cycles-grid">
        {cycles.map((c, i) => {
          const row = ROWS[i] ?? ROWS[ROWS.length - 1];
          const title = pick(c.title, locale);
          const note = c.countNote ? pick(c.countNote, locale) : null;
          // Кількість полотен відома не для всіх циклів. Поки її нема,
          // рядок із цифрою не рендериться зовсім — краще нічого,
          // ніж «— полотен» чи заглушка.
          const showCount = Boolean(c.count) || Boolean(note);
          return (
            // Зображення завжди перед назвою в DOM: на телефоні колонки
            // схлопуються в одну, і порядок стає «фото, потім назва».
            <div key={c.id} className="cycle-row" style={{ display: "contents" }}>
              {/* Кадр веде туди ж, куди й назва поруч, — це те саме посилання
                  двічі: два кроки табуляції, і скрінрідер читав назву циклу
                  двічі (aria-label кадру, потім саму назву). Мишею й пальцем
                  кадр клікабельний, як і був; з клавіатури й для допоміжних
                  технологій лишається одне посилання — назва. Картинка
                  всередині тоді декоративна: alt="". */}
              <Link
                href={`/${locale}/cycles/${c.slug}`}
                className="cycle-img"
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  gridColumn: row.img.col,
                  gridRow: i + 1,
                  aspectRatio: row.img.aspect,
                }}
              >
                <div className="cycle-img-inner">
                  {c.img
                    ? <Image src={c.img} alt="" fill sizes="(max-width: 920px) 100vw, 55vw" />
                    : <div className="cycle-img-empty" />}
                </div>
              </Link>

              <div
                className="cycle-text"
                style={{
                  gridColumn: row.text.col,
                  gridRow: i + 1,
                  textAlign: row.text.align,
                }}
              >
                {/* Назва веде туди ж, куди й зображення. Обхід із
                    pointer-events більше не потрібен: текст стоїть у своїй
                    колонці й нічого не накриває. */}
                <h3 className={c.featured ? "cycle-title featured" : "cycle-title"}>
                  <Link href={`/${locale}/cycles/${c.slug}`} className="cycle-title-link">{title}</Link>
                </h3>
                {showCount && (
                  <span
                    className="cycle-count"
                    style={{ justifyContent: row.text.align === "right" ? "flex-end" : "flex-start" }}
                  >
                    {c.count && <span>{c.count} {t.cycles.canvases}</span>}
                    {note && <span>{note}</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cycles-foot">
        <p className="cycles-note">{t.cycles.stanczykNote}</p>
        <Link href={`/${locale}/cycles`} className="cycles-all">{t.cycles.viewAll}</Link>
      </div>
    </section>
  );
}
