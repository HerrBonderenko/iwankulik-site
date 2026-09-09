"use client";
import { useCallback, useId, useState } from "react";
import Image from "next/image";
import { pick, interpolate } from "@/lib/i18n";
import { useDialog } from "@/lib/useDialog";
import OrderForm from "@/components/OrderForm";

export default function InquiryModal({ t, locale, painting, email, phone, onClose }) {
  // Escape, блокування прокрутки, пастка Tab і повернення фокуса на
  // кнопку-відкривач — усе в спільному хуку, тому самому, що й у
  // мобільного меню. Модалка змонтована лише коли відкрита, тож open=true.
  // Появу малює CSS через @starting-style — тут її нема зовсім.
  // Закриття веде модалка сама: батько знімає її з DOM уже після того,
  // як вона догра, бо onClose викликається із затримкою. Так Gallery
  // лишається без стану анімації.
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
    // 240 мс — стільки ж, скільки в .modal-backdrop і .modal.
    setTimeout(onClose, 240);
  }, [onClose]);

  const dialog = useDialog(true, close);
  const titleId = useId();

  const title = pick(painting.title, locale);
  // Модалка відкривається лише для доступних робіт (див. Gallery.js),
  // тож заголовок один — запит ціни по конкретному полотну.
  const heading = t.form.title;
  // Текст-контекст у полі коментаря — щоб і клієнт, і Іван одразу бачили,
  // про яку роботу йдеться. Реальне збагачення листа (код/розмір/ціна)
  // все одно йде на сервері з даних сайту за workId, а не з цього тексту.
  const prefill = interpolate(t.form.paintingPrefill, { title, code: painting.code || "", size: painting.size || "" });
  return (
    <div className="modal-backdrop" data-closing={closing} onClick={close}>
      {/* tabIndex={-1} — щоб фокус можна було поставити на сам контейнер:
          так скрінрідер читає заголовок діалогу, а не підпис хрестика.
          У цикл Tab контейнер при цьому не входить. */}
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={close} aria-label={t.form.close}>✕</button>
        <div className="modal-head">
          <div className="modal-thumb">
            <Image src={painting.img} alt={title} fill sizes="72px" />
          </div>
          <div>
            <div id={titleId} style={{ fontWeight: 500 }}>{heading}</div>
            <div className="small muted">{title} · {painting.size} см · {painting.year}</div>
            {painting.code && <div className="work-code">{painting.code}</div>}
          </div>
        </div>
        {/* extra: серверу вистачає id роботи — номер, назву, фото й розмір
            для листа він бере з даних сайту сам, щоб вони були справжніми. */}
        <OrderForm
          t={t}
          subject={`${heading}: ${title}`}
          email={email}
          phone={phone}
          endpoint="/api/inquiry/painting"
          extra={{ workId: painting.id }}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
