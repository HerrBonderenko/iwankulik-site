import Image from "next/image";

// Розкладка фотоколажу праворуч. Координати з макета — три кадри
// різного розміру, свідомо не вирівняні в сітку: це стіна майстерні,
// а не каталог. Нижче 1200px усе це перебивається сіткою в CSS.
const PHOTOS = [
  { key: "signing", left: 0, top: 0, width: 360, height: 450 },
  { key: "studio", left: 398, top: 150, width: 346, height: 290 },
  { key: "certificate", left: 150, top: 490, width: 300, height: 210 },
];

const ITEMS = ["direct", "signature", "certificate", "handover"];

export default function AuthenticitySection({ t, photos = {} }) {
  const certificate = photos.certificate;

  return (
    <section className="authenticity" id="authenticity">
      <div className="container auth-inner">
        <div className="auth-left">
          <h2>{t.authenticity.title}</h2>
          <p className="auth-lead">{t.authenticity.lead}</p>

          <div className="auth-list">
            {ITEMS.map((key) => (
              <div key={key} className="auth-item">
                <span className="auth-item-label">{t.authenticity.items[key].label}</span>
                <span className="auth-item-text">{t.authenticity.items[key].text}</span>
              </div>
            ))}
          </div>

          <div className="auth-actions">
            <a href="#zayavka" className="btn-primary">{t.authenticity.ctaPrimary}</a>
            {/* Без залитого скана кнопки нема зовсім. Раніше на її місці
                стояв <button> без onClick — на вигляд робочий, на дотик
                мертвий. Порожнє місце чесніше. */}
            {certificate && (
              <a className="btn-secondary" href={certificate} target="_blank" rel="noopener noreferrer">
                {t.authenticity.ctaSecondary}
              </a>
            )}
          </div>
        </div>

        <div className="auth-photos">
          {PHOTOS.map((p) => {
            const src = photos[p.key];
            return (
              <div
                key={p.key}
                className="auth-photo"
                style={{ left: p.left, top: p.top, width: p.width, height: p.height }}
              >
                {src && (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 1200px) 50vw, 360px"
                    style={{ objectFit: "cover" }}
                  />
                )}
              </div>
            );
          })}
          <p className="auth-note">{t.authenticity.photoNote}</p>
        </div>
      </div>
    </section>
  );
}
