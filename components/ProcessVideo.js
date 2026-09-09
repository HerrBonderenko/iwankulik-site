"use client";
import { useRef, useState } from "react";

/* Відео процесу зі звуком, який вмикає сама людина.
   Стартує без звуку — інакше браузер заблокує автозапуск.
   hasSound задаємо вручну: визначати доріжку на льоту ненадійно,
   бо браузер дізнається про неї лише коли відео вже грає, а на
   телефоні в режимі енергозбереження автозапуску може й не бути. */
export default function ProcessVideo({ src, poster, hasSound, labelOn, labelOff }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    const next = !on;
    v.muted = !next;
    setOn(next);
    // Клік — той самий жест, якого чекає браузер, тож можна дограти зі звуком.
    if (next) v.play().catch(() => {});
  }

  return (
    <div className="process-video">
      <video ref={ref} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" />
      {hasSound && (
        <button type="button" className="sound-btn" onClick={toggle} aria-pressed={on}>
          <span aria-hidden="true">{on ? "🔊" : "🔇"}</span>
          {on ? labelOff : labelOn}
        </button>
      )}
    </div>
  );
}
