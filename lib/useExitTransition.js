"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Відкриття/закриття діалогу, у якому закриття встигає програтись.
 *
 * `{open && <Dialog/>}` знімає вузол тим самим кадром, у якому змінився
 * прапорець, тож анімувати вихід нема чому. Тут відкритість розкладена
 * на дві: open — логічний стан (з нього живуть aria-expanded і пастка
 * фокуса), closing — вузол ще в DOM, але вже їде геть.
 *
 * Появу ловить CSS через @starting-style, тому сюди вона не заходить
 * зовсім: JS лишається тільки те, чого CSS не вміє, — відкладене
 * зняття з DOM.
 *
 * duration має збігатися з тривалістю переходу в CSS — інакше вузол
 * зникне раніше, ніж догра.
 */
export function useExitTransition(duration) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setClosing(true);
    // Рух вимкнено в системі — чекати нема чого, знімаємо наступним тіком.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => setClosing(false), still ? 0 : duration);
  }, [duration]);

  // Компонент могли зняти з DOM посеред закриття (перехід на іншу
  // сторінку пунктом самого меню) — таймер тоді нікому не потрібен.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { open, closing, mounted: open || closing, show, hide };
}
