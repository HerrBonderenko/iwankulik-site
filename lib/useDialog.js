"use client";
import { useEffect, useRef } from "react";

// Що вважаємо фокусованим усередині діалогу. tabindex="-1" виключено
// навмисно: такі елементи фокусуються тільки програмно, у цикл Tab
// вони не входять — інакше сам контейнер діалогу потрапив би в цикл.
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Спільна поведінка модалки заявки й мобільного меню: перенесення фокуса
 * всередину, замкнений цикл Tab, повернення фокуса на елемент-відкривач,
 * Escape і блокування прокрутки фону.
 *
 * Повертає ref, який треба повісити на контейнер діалогу. Контейнеру
 * потрібен tabIndex={-1} — фокус спершу ставимо саме на нього, щоб
 * скрінрідер прочитав заголовок діалогу, а не підпис першої кнопки.
 */
export function useDialog(open, onClose) {
  const ref = useRef(null);
  // onClose приходить новою стрілкою на кожен рендер батька
  // (onClose={() => setAsk(null)}). Якби ефект залежав від неї напряму,
  // він перезапускався б на кожен рендер: фокус скакав би на початок,
  // а блокування прокрутки знімалось і ставилось заново.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;

    // Хто відкрив — туди й повернемо фокус на закритті.
    const opener = document.activeElement;

    // Список рахуємо щоразу заново: у формі з'являються повідомлення
    // про помилки, кнопка «Надіслати» на час відправки стає disabled.
    // getClientRects замість offsetParent — той дає null для елементів
    // усередині position: fixed, а мобільне меню саме таке.
    // tabIndex >= 0 відсіює те, що з циклу Tab виведено навмисно: поле-
    // пастка для ботів у формі — звичайний <input> із tabIndex={-1},
    // і без цієї перевірки фокус ішов би на нього за 5000px від екрана.
    const items = () =>
      [...node.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
      );

    // preventScroll обов'язковий: контейнер діалогу — position: fixed, але
    // браузер усе одно проганяє для нього scroll-into-view, а в нас на html
    // стоїть scroll-behavior: smooth. Без цього прапорця сторінка під
    // діалогом плавно їхала на початок, і після закриття читач опинявся
    // не там, де був.
    node.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) {
        e.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      // Замикаємо цикл. Третя умова — коли фокус на самому контейнері
      // або десь поза діалогом (клік по тлу, фокус із адресного рядка).
      if (e.shiftKey ? active === first : active === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!list.includes(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // Блокування прокрутки фону. Смуга прокрутки зникає разом із нею, і
    // без компенсації вся сторінка стрибнула б праворуч на її ширину.
    // Шапка sticky, тобто в потоці body, тож цей же padding тримає і її.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prev = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    document.body.style.overflow = "hidden";
    if (gap > 0) {
      const pad = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${pad + gap}px`;
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev.overflow;
      document.body.style.paddingRight = prev.paddingRight;
      // Повертаємо фокус, лише якщо відкривач ще на сторінці: перехід
      // за пунктом меню міняє сторінку, і старої кнопки вже може не бути.
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return ref;
}
