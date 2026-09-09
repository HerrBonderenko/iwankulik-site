"use client";
import { useEffect, useState } from "react";

// Ці коди означають, що проблема у введених даних — виправляти має сам
// відвідувач, тож телефон/email художника як запасний контакт тут недоречні
// (на відміну від mail_failed/rate_limit/невідомої помилки — там це не
// провина відвідувача, і альтернативний контакт справді допомагає).
const INPUT_ERROR_CODES = ["invalid_email", "invalid_phone", "too_long", "missing_fields"];

export default function OrderForm({ t, subject, inline, email, phone, endpoint = "/api/inquiry", extra, isGeneralForm, prefill }) {
  const [status, setStatus] = useState("idle");
  const [errorCode, setErrorCode] = useState(null);
  const [token, setToken] = useState(null);

  // Підписаний timestamp "форму відкрито" — беремо одразу при рендері,
  // щоб сервер міг відрізнити людину від бота за паузою до сабміту.
  useEffect(() => {
    fetch("/api/form-token")
      .then((r) => r.json())
      .then(setToken)
      .catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.subject = subject || t.form.title;
    if (extra) Object.assign(data, extra);
    setStatus("sending");
    try {
      // Токен міг ще не встигнути прийти (повільна мережа) — добираємо його
      // тут-таки, щоб не блокувати кнопку відправки назавжди при невдачі.
      let tok = token;
      if (!tok) {
        try {
          tok = await fetch("/api/form-token").then((r) => r.json());
        } catch {
          tok = null;
        }
      }
      if (tok) {
        data.formTs = tok.ts;
        data.formSig = tok.sig;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "");
      }
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorCode(err.message || "");
    }
  }

  // Набір полів однаковий скрізь: ім'я, email, телефон, коментар. Поля
  // «місто», «розмір» і «сюжет» прибрані — вони питали параметри роботи,
  // якої ще нема, а сайт продає готові полотна з відомим розміром.
  // isGeneralForm — загальна форма сторінки (головна, контакти) на
  // відміну від модалки по конкретній роботі: лишає заголовок над
  // формою й позначку типу заявки. Заголовок видно й після відправки.
  if (status === "sent") {
    return (
      <>
        {isGeneralForm && <h2 className="cta-title">{t.home.ctaTitles.painting}</h2>}
        {/* Підтвердження заявки — найважливіша мить усієї воронки, і
            досі вона виглядала як підміна вмісту. Тепер проступає. */}
        <p className="form-sent">{t.form.sent}</p>
      </>
    );
  }

  return (
    <>
      {isGeneralForm && <h2 className="cta-title">{t.home.ctaTitles.painting}</h2>}
      <form className="form" onSubmit={onSubmit} style={inline ? { maxWidth: 480, margin: "0 auto", textAlign: "left" } : undefined}>
        {isGeneralForm && <input type="hidden" name="orderType" value="painting" />}
        <label>
          {t.form.name}
          <input name="name" autoComplete="name" required maxLength={100} />
        </label>
        <label>
          {t.form.email}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
          />
        </label>
        <label>
          {t.form.phone}
          {/* type="tel" вмикає телефонну клавіатуру й підказку
              автозаповнення; inputMode лишається як запасний. */}
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={25}
            pattern="[0-9\s+\-\(\)]*"
          />
        </label>
        <label>{t.form.comment}<textarea name="comment" rows={3} maxLength={2000} defaultValue={prefill} /></label>
        {/* Пастка для ботів: звичайне на вигляд поле, сховане стилями (не
            hidden-атрибутом, який автозаповнювачі часто ігнорують). Людина
            його не бачить і не заповнює. */}
        <input type="text" name="website" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <input type="hidden" name="formTs" value={token?.ts || ""} />
        <input type="hidden" name="formSig" value={token?.sig || ""} />
        <button type="submit" disabled={status === "sending"}>{t.form.send}</button>
        <span className="form-note">{t.gallery.replyFast}</span>
        {status === "error" && (
          <span className="form-note form-error">
            {INPUT_ERROR_CODES.includes(errorCode) ? (
              t.form.errors[errorCode]
            ) : (
              <>
                {(errorCode && t.form.errors[errorCode]) || t.form.error}{" "}
                {phone && (
                  <>
                    <a className="link" href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>
                    {" · "}
                  </>
                )}
                <a className="link" href={`mailto:${email}`}>{email}</a>
              </>
            )}
          </span>
        )}
      </form>
    </>
  );
}
