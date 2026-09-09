"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/workCodes";

/* Пошук картини за постійним номером (К-001). Той самий номер стоїть
   у сертифікаті автентичності до роботи — тож власник картини (або той,
   кому її показують) може знайти полотно на сайті просто за номером
   з документа й переконатися, що воно справді з цієї майстерні.
   Живе у футері, тобто доступний з будь-якої сторінки. */
export default function WorkCodeSearch({ locale, t, works }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");

  function submit(e) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;

    // Формат пояснюємо лише тому, хто в ньому помилився — постійна
    // підказка у футері була б шумом на кожній сторінці.
    const code = normalizeCode(raw);
    if (!code) { setMsg(t.search.badFormat); return; }

    const work = works.find((w) => w.code === code);
    if (!work) { setMsg(`${t.search.notFound} ${code}`); return; }

    setMsg("");
    setValue("");

    // Картина живе в галереї як ?w=. Якщо галерея вже відкрита, зміна
    // самого лише query її не перемонтує — тоді правимо адресу самі
    // й будимо тих, хто слухає popstate (Gallery саме так її й читає).
    const target = `/${locale}/zhyvopys?w=${encodeURIComponent(work.key)}`;
    if (window.location.pathname === `/${locale}/zhyvopys`) {
      window.history.pushState(null, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    router.push(target);
  }

  return (
    <form className="footer-search" onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); if (msg) setMsg(""); }}
        placeholder={t.search.placeholder}
        aria-label={t.search.label}
        title={t.search.label}
        autoComplete="off"
        spellCheck="false"
        enterKeyHint="search"
      />
      {/* Кнопка обов'язкова: на телефоні Enter у клавіатурі може не бути. */}
      <button type="submit">{t.search.action}</button>
      {msg && <span className="footer-search-msg" role="status">{msg}</span>}
    </form>
  );
}
