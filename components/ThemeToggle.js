"use client";
import { useEffect, useState } from "react";

/* Studio Light Switcher — перемикач фону сайту.
   Олія виглядає по-різному на музейному темному тлі й при денному
   світлі, тож вибір віддано відвідувачу.

   Компонент навмисно без стану. Тему тримає атрибут data-theme на
   <html>, який ставить інлайн-скрипт у layout.js ще до першої
   відмальовки. Обидва підписи рендеряться завжди, а зайвий ховає CSS
   за цим самим атрибутом — тому:
   - немає розбіжності гідратації (сервер не знає вибір відвідувача);
   - підпис правильний ще до того, як завантажиться JS;
   - немає setState в ефекті й каскадного перерендеру.
   display: none прибирає прихований варіант і з дерева доступності,
   тож скрінрідер читає рівно один підпис. */
function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.4M12 19.2v2.4M4.2 12H1.8M22.2 12h-2.4M6.5 6.5 4.8 4.8M19.2 19.2l-1.7-1.7M17.5 6.5l1.7-1.7M4.8 19.2l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" />
    </svg>
  );
}

// Скільки триває перефарбовування. Те саме число стоїть у globals.css
// для [data-theme-switching]; тут воно потрібне, щоб вчасно зняти атрибут.
const THEME_SWITCH_MS = 240;
let switchTimer = null;

function toggle() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";

  // Тло сторінки досі мінялося ривком, а шапка й посилання доїжджали
  // кожне у свій строк — три різні швидкості на одну дію. Атрибут
  // вмикає спільний перехід на час перемикання і знімається одразу
  // після: тримати його постійно означало б сповільнити геть усі
  // ховери на сайті.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-theme-switching", "");
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.removeAttribute("data-theme-switching"), THEME_SWITCH_MS);
  }

  root.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (e) {}
}

export default function ThemeToggle({ t }) {
  // Тему тримає атрибут на <html>, а не React. Читаємо його після
  // гідратації: на сервері вибору відвідувача ще не знають, і будь-яке
  // значення тут дало б розбіжність розмітки.
  const [pressed, setPressed] = useState(undefined);
  useEffect(() => {
    const read = () =>
      setPressed(document.documentElement.getAttribute("data-theme") === "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  return (
    // aria-label прибрано: він перекривав видимий підпис («Світла»),
    // і скрінрідер читав загальне «Тема» замість того, що станеться.
    // aria-pressed лишає стан перемикача — але його значення відоме лише
    // в браузері, тож на сервері атрибута нема (undefined його не друкує).
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      aria-pressed={pressed}
      title={t.theme}
    >
      {/* Показуємо те, на що перемкнемо: у темній темі — сонце й «Світла». */}
      <span className="theme-btn-on-dark">
        <SunIcon />
        <span>{t.themeLight}</span>
      </span>
      <span className="theme-btn-on-light">
        <MoonIcon />
        <span>{t.themeDark}</span>
      </span>
    </button>
  );
}
