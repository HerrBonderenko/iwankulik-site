"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { normalizePrice } from "@/lib/price";

/* Мініатюрне стиснення фото в браузері перед завантаженням:
   телефонні знімки по 8–12 МБ не пролазять у ліміт запиту
   і не потрібні сайту в такому розмірі. */
async function compressImage(file, maxSide = 1920, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const translit = (s) =>
  s.toLowerCase()
    .replace(/[аa]/g, "a").replace(/б/g, "b").replace(/[вv]/g, "v").replace(/г/g, "h")
    .replace(/ґ/g, "g").replace(/д/g, "d").replace(/[еєe]/g, "e").replace(/ж/g, "zh")
    .replace(/з/g, "z").replace(/[иіїy i]/g, "i").replace(/й/g, "i").replace(/к/g, "k")
    .replace(/л/g, "l").replace(/м/g, "m").replace(/н/g, "n").replace(/[оo]/g, "o")
    .replace(/п/g, "p").replace(/р/g, "r").replace(/с/g, "s").replace(/т/g, "t")
    .replace(/у/g, "u").replace(/ф/g, "f").replace(/х/g, "kh").replace(/ц/g, "ts")
    .replace(/ч/g, "ch").replace(/ш/g, "sh").replace(/щ/g, "shch").replace(/ю/g, "iu")
    .replace(/я/g, "ia").replace(/ь/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const TABS = [
  { id: "paintings", label: "Картини (олія)" },
  { id: "cycles", label: "Цикли" },
  { id: "authenticity", label: "Автентичність" },
  { id: "blog", label: "Блог" },
  { id: "hero", label: "Головна" },
  { id: "about", label: "Про мене" },
  { id: "contacts", label: "Контакти" },
];
const TAB_HINT = {
  paintings: "Ці картини показуються в розділі «Живопис». Верхня в списку — перша в галереї.",
  about: "Це сторінка «Про мене» — текст про себе і фото під ним.",
  authenticity: "Три фото для блоку про автентичність на головній. Усі три — необов'язкові: поки фото нема, на його місці порожній кадр.",
  cycles: "П'ять тематичних циклів. Склад списку сталий — від нього залежать адреси сторінок; редагується назва, кількість полотен, фото й текст сторінки циклу.",
};
const STATUSES = { available: "в наявності", sold: "продано", collection: "у приватній колекції" };
const LANGS = ["en", "pl", "de", "ru"];

// Підпис "Завантажив: Ім'я, 25.08.2026 14:22" під фото. Для старих
// фото без цих полів — нічого не показуємо, а не падаємо.
function formatUploadMeta(obj) {
  if (!obj?.uploadedByName || !obj?.uploadedAt) return null;
  const d = new Date(obj.uploadedAt);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `Завантажив: ${obj.uploadedByName}, ${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

function langField(value, onChange, label) {
  return (
    <div className="langs-grid">
      {LANGS.map((l) => (
        <label key={l}>
          {label} ({l.toUpperCase()}) — необов&apos;язково
          <input value={value[l] || ""} onChange={(e) => onChange(l, e.target.value)} />
        </label>
      ))}
    </div>
  );
}

/* Фото — перше і головне поле форми. Показує прев'ю одразу
   після вибору, щоб з телефона було видно, що саме завантажується. */
function PhotoField({ file, setFile, existing }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  const shown = preview || existing;
  return (
    <div className="photo-field">
      {shown
        ? (
          <div className="photo-field-preview">
            <Image
              src={shown}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 340px"
              style={{ objectFit: "cover" }}
              unoptimized={Boolean(preview)}
            />
          </div>
        )
        : <div className="photo-field-empty">фото ще не обрано</div>}
      <label className="photo-field-btn">
        {shown ? "Замінити фото" : "📷 Обрати фото *"}
        <input type="file" accept="image/*" hidden
          onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
      {preview && <span className="small muted">Нове фото обрано ✓</span>}
      {!shown && <span className="small muted">Можна зняти камерою або взяти з галереї телефона</span>}
    </div>
  );
}

function PaintingForm({ initial, onSave, onCancel, busy, cycles = [] }) {
  const [p, setP] = useState(
    initial || {
      id: "", img: "", title: { uk: "" }, size: "",
      tech: { uk: "олія на полотні" }, year: String(new Date().getFullYear()),
      cycle: null, status: "available", price: "",
    }
  );
  const [file, setFile] = useState(null);
  const set = (patch) => setP((v) => ({ ...v, ...patch }));

  return (
    <div className="admin-form">
      <PhotoField file={file} setFile={setFile} existing={p.img} />
      <div className="row2">
        <label>
          назва (українською) *
          <input value={p.title.uk} onChange={(e) => set({ title: { ...p.title, uk: e.target.value } })} />
        </label>
        <label>
          статус
          <select value={p.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <span className="admin-note">
        «Продано» і «у приватній колекції» лишаються на сайті: біля них замість ціни
        буде кнопка «Замовити схожу».
      </span>
      <div className="row2">
        <label>
          розмір, см
          <input value={p.size} placeholder="напр.: 60 × 80" onChange={(e) => set({ size: e.target.value })} />
        </label>
        <label>
          рік
          <input value={p.year} placeholder="напр.: 2026" onChange={(e) => set({ year: e.target.value })} />
        </label>
      </div>
      <label>
        ціна, €
        <span className="price-input">
          <span className="price-prefix" aria-hidden="true">€</span>
          <input value={p.price || ""} placeholder="325 (порожньо = за запитом)"
            onChange={(e) => set({ price: normalizePrice(e.target.value) })} />
        </span>
      </label>
      <label>
        техніка
        <input value={p.tech.uk || ""} onChange={(e) => set({ tech: { ...p.tech, uk: e.target.value } })} />
      </label>
      <label>
        цикл
        <select value={p.cycle || ""} onChange={(e) => set({ cycle: e.target.value || null })}>
          <option value="">поза циклами</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.title.uk}</option>)}
        </select>
      </label>
      <span className="admin-note">
        Цикл вмикає кнопку-фільтр на головній. Фільтр показується тільки для
        циклів, у яких є хоча б одна доступна робота.
      </span>
      <details>
        <summary>Переклади назви (EN / PL / DE / RU)</summary>
        {langField(p.title, (l, v) => set({ title: { ...p.title, [l]: v } }), "назва")}
      </details>
      <details>
        <summary>Переклади техніки (EN / PL / DE / RU)</summary>
        {langField(p.tech, (l, v) => set({ tech: { ...p.tech, [l]: v } }), "техніка")}
      </details>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="admin-save" disabled={busy} onClick={() => onSave(p, file)}>
          {busy ? "Зберігаю…" : "Зберегти"}
        </button>
        <button onClick={onCancel} className="link small" style={{ alignSelf: "center" }}>скасувати</button>
      </div>
    </div>
  );
}

/* Три фото для блоку «Автентичність» на головній. Кожен слот
   незалежний і необов'язковий — редактор може залити одне фото зараз,
   решту потім. На диск іде тільки по «Зберегти», як у HeroTab. */
const AUTH_SLOTS = [
  { key: "signing", label: "Художник підписує полотно", hint: "крупний план підпису на лицьовому боці" },
  { key: "studio", label: "Майстерня у Варшаві", hint: "загальний план простору" },
  { key: "certificate", label: "Сертифікат автентичності", hint: "скан або фото бланка; це фото ще й відкривається по кнопці «Подивитися сертифікат»" },
];

function AuthenticityTab({ data, setData, persist, uploadPhoto, busy }) {
  const [uploading, setUploading] = useState(null);
  const photos = data.authenticityPhotos || {};

  async function onUpload(key, file) {
    if (!file) return;
    setUploading(key);
    try {
      const meta = await uploadPhoto(file);
      setData({ ...data, authenticityPhotos: { ...photos, [key]: meta.url } });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div>
      {AUTH_SLOTS.map((slot) => (
        <div key={slot.key} style={{ marginBottom: 24 }}>
          <span className="small muted" style={{ display: "block", marginBottom: 2 }}>{slot.label}</span>
          <span className="small muted" style={{ display: "block", marginBottom: 8 }}>{slot.hint}</span>
          {photos[slot.key]
            ? (
              <div style={{ position: "relative", overflow: "hidden", width: "100%", maxWidth: 340, aspectRatio: "4/5", background: "var(--bg-panel)" }}>
                <Image src={photos[slot.key]} alt="" fill sizes="(max-width: 640px) 100vw, 340px" style={{ objectFit: "cover" }} />
              </div>
            )
            : <div style={{ width: "100%", maxWidth: 340, aspectRatio: "4/5", background: "var(--bg-panel)" }} />}
          <label style={{ display: "block", marginTop: 8, fontSize: 13, color: "var(--text-tertiary)" }}>
            {photos[slot.key] ? "замінити фото" : "завантажити фото"}
            <input type="file" accept="image/*" style={{ display: "block", marginTop: 6 }}
              onChange={(e) => onUpload(slot.key, e.target.files[0])} />
          </label>
          {photos[slot.key] && (
            <button className="link small" style={{ marginTop: 6 }}
              onClick={() => setData({ ...data, authenticityPhotos: { ...photos, [slot.key]: "" } })}>
              прибрати фото
            </button>
          )}
        </div>
      ))}

      <button className="admin-save" disabled={busy || Boolean(uploading)} onClick={() => persist(data)}>
        {uploading ? "Завантажую фото…" : busy ? "Зберігаю…" : "Зберегти"}
      </button>
    </div>
  );
}

/* Цикли. Відрізняються від картин двома речами:
   - склад списку сталий (id і slug визначають маршрути /cycles/[slug]),
     тож тут можна лише редагувати й переставляти, але не додавати й не
     видаляти — сервер такі зміни все одно відкине;
   - фото необов'язкове: поки його нема, на сайті стоїть порожній
     прямокутник, і це нормальний робочий стан. */
function CycleForm({ initial, onSave, onCancel, busy }) {
  const [c, setC] = useState(initial);
  const [file, setFile] = useState(null);
  const set = (patch) => setC((v) => ({ ...v, ...patch }));
  const note = c.countNote || {};
  const text = c.text || {};
  const setText = (l, v) => set({ text: { ...text, [l]: v } });

  return (
    <div className="admin-form">
      <PhotoField file={file} setFile={setFile} existing={c.img} />
      <span className="admin-note">
        Фото не обов&apos;язкове: поки його нема, на сайті стоїть порожній кадр,
        а назва циклу видно й без нього.
      </span>
      <div className="row2">
        <label>
          назва (українською) *
          <input value={c.title.uk || ""}
            onChange={(e) => set({ title: { ...c.title, uk: e.target.value } })} />
        </label>
        <label>
          кількість полотен
          <input value={c.count || ""} placeholder="напр.: ≈ 700 (порожньо = не показувати)"
            onChange={(e) => set({ count: e.target.value })} />
        </label>
      </div>
      <label>
        уточнення біля кількості (українською)
        <input value={note.uk || ""} placeholder="напр.: 90 у польському виданні"
          onChange={(e) => set({ countNote: { ...note, uk: e.target.value } })} />
      </label>
      <label>
        текст сторінки циклу (українською)
        <textarea rows={10} value={text.uk || ""}
          onChange={(e) => setText("uk", e.target.value)} />
      </label>
      <span className="admin-note">
        Показується на сторінці циклу під фото. Щоб почати новий абзац,
        залиште між рядками один порожній рядок.
      </span>
      <details>
        <summary>Текст іншими мовами (EN / PL / DE / RU)</summary>
        <div className="langs-grid">
          {LANGS.map((l) => (
            <label key={l}>
              текст ({l.toUpperCase()}) — необов&apos;язково
              <textarea rows={7} value={text[l] || ""}
                onChange={(e) => setText(l, e.target.value)} />
            </label>
          ))}
        </div>
      </details>
      <details>
        <summary>Переклади назви (EN / PL / DE / RU)</summary>
        {langField(c.title, (l, v) => set({ title: { ...c.title, [l]: v } }), "назва")}
      </details>
      <details>
        <summary>Переклади уточнення (EN / PL / DE / RU)</summary>
        {langField(note, (l, v) => set({ countNote: { ...note, [l]: v } }), "уточнення")}
      </details>
      <div className="row2">
        <label>
          id (не редагується)
          <input value={c.id} readOnly disabled />
        </label>
        <label>
          адреса сторінки (не редагується)
          <input value={`/cycles/${c.slug}`} readOnly disabled />
        </label>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="admin-save" disabled={busy} onClick={() => onSave(c, file)}>
          {busy ? "Зберігаю…" : "Зберегти"}
        </button>
        <button onClick={onCancel} className="link small" style={{ alignSelf: "center" }}>скасувати</button>
      </div>
    </div>
  );
}

function CyclesTab({ data, persist, uploadPhoto, busy, flash }) {
  const [editing, setEditing] = useState(null);
  // Своя ознака зайнятості: батьківський busy вмикається лише на persist(),
  // а завантаження фото триває до нього — без цього кнопку можна натиснути двічі.
  const [saving, setSaving] = useState(false);

  async function save(index, item, file) {
    try {
      if (!item.title.uk) { flash("Вкажіть назву"); return; }
      setSaving(true);
      let next = item;
      if (file) {
        const meta = await uploadPhoto(file);
        next = { ...item, img: meta.url, uploadedBy: meta.uploadedBy, uploadedByName: meta.uploadedByName, uploadedAt: meta.uploadedAt };
      }
      // Порожні переклади не тримаємо у сховищі — інакше countNote
      // перетворюється на {uk:"",en:"",...} і pick() віддає порожній рядок
      // замість того, щоб відкотитись на наявну мову.
      const clean = (obj) => {
        const out = {};
        for (const [k, v] of Object.entries(obj || {})) if (v) out[k] = v;
        return Object.keys(out).length ? out : null;
      };
      // text чиститься так само, але порожнім лишається об'єктом, а не
      // null: null для normalize() означає «поля нема» і текст досіявся б
      // із data/site.js назад — стерти його в адмінці стало б неможливо.
      next = {
        ...next,
        count: next.count || null,
        countNote: clean(next.countNote),
        text: clean(next.text) || {},
      };
      const list = [...data.cycles];
      list[index] = next;
      const ok = await persist({ ...data, cycles: list });
      if (ok) setEditing(null);
    } catch {
      flash("Помилка завантаження фото");
    } finally {
      setSaving(false);
    }
  }

  function move(index, dir) {
    const list = [...data.cycles];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    persist({ ...data, cycles: list });
  }

  return (
    <>
      {data.cycles.map((item, index) => {
        const uploadMeta = formatUploadMeta(item);
        return (
          <div key={item.id}>
            <div className="admin-row">
              <span className="admin-pos">{index + 1}</span>
              <div className="admin-thumb">
                {item.img
                  ? <Image src={item.img} alt="" fill sizes="96px" style={{ objectFit: "cover" }} />
                  : <span className="small muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>без фото</span>}
              </div>
              <div className="admin-row-title">
                <span>{item.title.uk}</span>
                <span className="small muted">
                  {[item.count ? `${item.count} полотен` : "кількість не вказана", `/cycles/${item.slug}`].join(" · ")}
                </span>
                {uploadMeta && <span className="small muted">{uploadMeta}</span>}
              </div>
              <div className="admin-actions">
                <button title="вгору" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                <button title="вниз" disabled={index === data.cycles.length - 1} onClick={() => move(index, 1)}>↓</button>
                <button className="act-edit" onClick={() => setEditing(index)}>змінити</button>
              </div>
            </div>
            {editing === index && (
              <CycleForm initial={item} busy={busy || saving} onCancel={() => setEditing(null)}
                onSave={(c, f) => save(index, c, f)} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* Обкладинки статей блогу. Список статей — з окремого API (MDX-файли
   не лежать у data-блобі), а сам override (data.blogCovers) — з того
   самого data-стейту й persist(), що й решта вкладок: завантаження фото
   одразу оновлює data.blogCovers локально, а на диск/у сховище йде тільки
   по «Зберегти» — так само як HeroTab. */
function BlogTab({ data, setData, persist, uploadPhoto, busy }) {
  const [posts, setPosts] = useState(null);
  const [uploadingSlug, setUploadingSlug] = useState(null);
  const covers = data.blogCovers || {};
  const alts = data.blogCoverAlts || {};

  useEffect(() => {
    fetch("/api/admin/blog-posts").then((r) => r.json()).then(setPosts);
  }, []);

  async function onUpload(slug, file) {
    if (!file) return;
    setUploadingSlug(slug);
    try {
      const meta = await uploadPhoto(file);
      setData({ ...data, blogCovers: { ...covers, [slug]: meta.url } });
    } finally {
      setUploadingSlug(null);
    }
  }

  function onReset(slug) {
    const next = { ...covers };
    delete next[slug];
    setData({ ...data, blogCovers: next });
  }

  // Порожнє поле = опису нема: чистимо ключ, щоб у сховищі не збиралися
  // порожні рядки й сторінка спокійно йшла до запасних варіантів.
  function onAlt(slug, locale, value) {
    const forSlug = { ...(alts[slug] || {}) };
    if (value.trim()) forSlug[locale] = value;
    else delete forSlug[locale];
    const next = { ...alts };
    if (Object.keys(forSlug).length) next[slug] = forSlug;
    else delete next[slug];
    setData({ ...data, blogCoverAlts: next });
  }

  if (!posts) return <p className="muted">Завантаження…</p>;

  return (
    <div>
      <p className="admin-note" style={{ marginBottom: 16 }}>
        Обкладинки статей блогу. Слаг спільний для всіх мов теми — одна
        обкладинка одразу на всі переклади. Поки нічого не завантажено,
        показується заготовка з файлу статті.
      </p>
      {posts.map((post) => {
        const current = covers[post.slug] || post.defaultCover;
        const hasOverride = Boolean(covers[post.slug]);
        return (
          <div key={post.slug} className="blog-admin-row">
            <div className="blog-admin-thumb">
              <Image src={current} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />
            </div>
            <div className="blog-admin-info">
              <strong>{post.title}</strong>
              <span className="small muted">{post.slug}</span>
              <div className="blog-admin-actions">
                <label className="photo-field-btn" style={{ padding: "8px 16px", fontSize: 13 }}>
                  {uploadingSlug === post.slug ? "Завантажую…" : "Завантажити обкладинку"}
                  <input type="file" accept="image/*" hidden disabled={uploadingSlug === post.slug}
                    onChange={(e) => onUpload(post.slug, e.target.files[0])} />
                </label>
                {hasOverride && (
                  <button className="link small" onClick={() => onReset(post.slug)}>
                    скинути до дефолту
                  </button>
                )}
              </div>
              <div className="blog-admin-alt">
                <label>
                  alt-опис обкладинки (UK)
                  <input
                    value={alts[post.slug]?.uk || ""}
                    onChange={(e) => onAlt(post.slug, "uk", e.target.value)}
                  />
                </label>
                {langField(alts[post.slug] || {}, (l, v) => onAlt(post.slug, l, v), "alt-опис")}
                <p className="small muted">
                  Опис того, що на зображенні, не назва статті. Для пошуку й доступності.
                  {!hasOverride && " Для вбудованої обкладинки опис уже є — заповнюйте, лише якщо треба інший."}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <button className="admin-save" disabled={busy || Boolean(uploadingSlug)}
        onClick={() => persist(data)} style={{ marginTop: 8 }}>
        {uploadingSlug ? "Завантажую фото…" : busy ? "Зберігаю…" : "Зберегти"}
      </button>
    </div>
  );
}

function HeroTab({ data, setData, persist, uploadPhoto, busy }) {
  const [uploading, setUploading] = useState(false);
  const current = data.hero?.img;

  async function onUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const meta = await uploadPhoto(file);
      // Саме злиття, а не заміна: у hero живуть ще videoEnabled і video,
      // а сервер вимагає їх строго (isValidHero). Без ...data.hero будь-яке
      // наступне збереження з будь-якої вкладки поверталося б 400.
      setData({
        ...data,
        hero: {
          ...data.hero,
          img: meta.url,
          uploadedBy: meta.uploadedBy,
          uploadedByName: meta.uploadedByName,
          uploadedAt: meta.uploadedAt,
        },
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="admin-note" style={{ marginBottom: 16 }}>
        Це велике фото на першому екрані сайту, праворуч від відео.
        Оберіть будь-яку роботу зі списку або завантажте окреме фото,
        потім натисніть «Зберегти». Краще за все виглядають горизонтальні
        фото без дрібних деталей.
      </p>
      <div style={{ marginBottom: 16 }}>
        <span className="small muted">Зараз на головній:</span>
        {current
          ? (
            <div style={{ position: "relative", overflow: "hidden", display: "block", marginTop: 8, width: "100%", maxWidth: 520, aspectRatio: "16/9", background: "var(--bg-panel)" }}>
              <Image src={current} alt="" fill sizes="(max-width: 640px) 100vw, 520px" style={{ objectFit: "cover" }} />
            </div>
          )
          : (
            <div style={{ display: "block", marginTop: 8, width: "100%", maxWidth: 520, aspectRatio: "16/9", background: "var(--bg-panel)" }} />
          )}
        {formatUploadMeta(data.hero) && (
          <span className="small muted" style={{ display: "block", marginTop: 4 }}>{formatUploadMeta(data.hero)}</span>
        )}
      </div>
      <div className="hero-pick">
        {data.paintings.map((p) => (
          <button
            key={p.id}
            className={"hero-pick-item" + (p.img === current ? " active" : "")}
            onClick={() => setData({ ...data, hero: { ...data.hero, img: p.img } })}
            title={p.title.uk}
          >
            <Image src={p.img} alt={p.title.uk} fill sizes="116px" />
          </button>
        ))}
      </div>
      <label style={{ display: "block", margin: "16px 0", fontSize: 13, color: "var(--text-tertiary)" }}>
        або завантажити окреме фото
        <input type="file" accept="image/*" style={{ display: "block", marginTop: 6 }}
          onChange={(e) => onUpload(e.target.files[0])} />
      </label>

      <div style={{ borderTop: "1px solid var(--a-line)", paddingTop: 16, marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(data.hero?.videoEnabled)}
            onChange={(e) => setData({ ...data, hero: { ...data.hero, videoEnabled: e.target.checked } })}
          />
          Показувати відео на головній
        </label>
        {!data.hero?.videoEnabled && (
          <span className="small muted" style={{ display: "block", marginTop: 6 }}>
            Відео вимкнено — на головній показується лише зображення.
          </span>
        )}
        <label style={{ display: "block", marginTop: 12, fontSize: 13, color: "var(--text-tertiary)" }}>
          шлях до відеофайлу
          <input
            value={data.hero?.video || ""}
            placeholder="/assets/video.mp4"
            onChange={(e) => setData({ ...data, hero: { ...data.hero, video: e.target.value } })}
            style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 420 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 18 }}>
          <input
            type="checkbox"
            checked={Boolean(data.processSection?.videoEnabled)}
            onChange={(e) => setData({ ...data, processSection: { ...data.processSection, videoEnabled: e.target.checked } })}
          />
          Показувати відео в секції «Процес»
        </label>
        {!data.processSection?.videoEnabled && (
          <span className="small muted" style={{ display: "block", marginTop: 6 }}>
            Відео вимкнено — у секції «Процес» показується лише текст.
          </span>
        )}
        <label style={{ display: "block", marginTop: 12, fontSize: 13, color: "var(--text-tertiary)" }}>
          шлях до відеофайлу секції «Процес»
          <input
            value={data.processSection?.video || ""}
            placeholder="/assets/video.mp4"
            onChange={(e) => setData({ ...data, processSection: { ...data.processSection, video: e.target.value } })}
            style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 420 }}
          />
        </label>
        <span className="small muted" style={{ display: "block", marginTop: 6 }}>
          Відео завантажується не через цю форму: кнопка «завантажити фото» приймає
          лише зображення (jpeg/png/webp, до 15 МБ) і перетискає їх. Файл кладе
          розробник у /public/assets, а сюди вписується шлях до нього.
        </span>
      </div>

      <div style={{ borderTop: "1px solid var(--a-line)", paddingTop: 16, marginTop: 8 }}>
        <span className="small muted" style={{ display: "block", marginBottom: 10 }}>
          Скільки картин показувати на головній. На сторінці «Живопис»
          показуються всі роботи, це стосується тільки головної.
        </span>
        <div className="home-count-pick">
          {[3, 6, 9].map((n) => (
            <button key={n} className={n === data.homeCount ? "active" : ""}
              onClick={() => setData({ ...data, homeCount: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <button className="admin-save" disabled={busy || uploading} onClick={() => persist(data)}>
        {uploading ? "Завантажую фото…" : busy ? "Зберігаю…" : "Зберегти"}
      </button>
    </div>
  );
}


/* Сторінка «Про мене»: текст і фото під ним.
   Абзаци розділяються порожнім рядком — так простіше,
   ніж пояснювати розмітку людині, далекій від верстки. */
function AboutTab({ data, persist, busy, uploadPhoto }) {
  const [about, setAbout] = useState(data.about);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const setText = (l, v) => setAbout({ ...about, text: { ...about.text, [l]: v } });

  async function save() {
    let next = about;
    if (file) {
      setUploading(true);
      try {
        const meta = await uploadPhoto(file);
        next = { ...about, img: meta.url, uploadedBy: meta.uploadedBy, uploadedByName: meta.uploadedByName, uploadedAt: meta.uploadedAt };
      } finally {
        setUploading(false);
      }
      setAbout(next);
      setFile(null);
    }
    persist({ ...data, about: next });
  }

  return (
    <div className="admin-form" style={{ boxShadow: "none" }}>
      <label>
        текст сторінки (українською)
        <textarea rows={10} value={about.text.uk || ""} onChange={(e) => setText("uk", e.target.value)} />
      </label>
      <span className="admin-note">
        Щоб почати новий абзац, залиште між рядками один порожній рядок.
      </span>

      <details>
        <summary>Текст іншими мовами (EN / PL / DE / RU)</summary>
        <div className="langs-grid">
          {LANGS.map((l) => (
            <label key={l}>
              текст ({l.toUpperCase()}) — необов&apos;язково
              <textarea rows={7} value={about.text[l] || ""} onChange={(e) => setText(l, e.target.value)} />
            </label>
          ))}
        </div>
      </details>

      <div style={{ borderTop: "1px solid var(--a-line)", paddingTop: 16 }}>
        <span className="admin-note">Фото під текстом</span>
        <div style={{ marginTop: 10 }}>
          <PhotoField file={file} setFile={setFile} existing={about.img} />
          {formatUploadMeta(about) && (
            <span className="small muted" style={{ display: "block", marginTop: 6 }}>{formatUploadMeta(about)}</span>
          )}
        </div>
      </div>

      <button className="admin-save" disabled={busy || uploading} onClick={save}>
        {uploading ? "Завантажую фото…" : busy ? "Зберігаю…" : "Зберегти"}
      </button>
    </div>
  );
}

// Відповіді сервера на невдале збереження. Ключ — поле error у тілі.
const SAVE_ERRORS = {
  "bad data": "Дані не пройшли перевірку. Оновіть сторінку і спробуйте ще раз.",
  save_failed: "Сховище не прийняло запис. Набране не втрачено — натисніть «Зберегти» ще раз.",
};

export default function AdminApp({ user }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("paintings");
  const [editing, setEditing] = useState(null); // { kind, index } | { kind, index: -1 } для нового
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/data").then((r) => r.json()).then(setData);
  }, []);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  // busy — один на всю адмінку, тож знімати його треба за будь-якого
  // результату. Раніше setBusy(false) стояв після await без try/catch:
  // варто було fetch відхилитись (перезапуск сервера, обрив мережі), як усі
  // кнопки «Зберегти» лишалися заблокованими до перезавантаження сторінки.
  async function persist(next) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
        // Без таймауту запит, який завис у мережі, тримав би кнопку вічно.
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        // "bad data"    — сервер відхилив вміст, повторювати те саме марно.
        // "save_failed" — вміст правильний, не спрацював запис у сховище;
        //                 набране лишається на екрані, повтор має сенс.
        // null          — тіло не розібралось (наприклад, сторінка входу
        //                 замість JSON після того, як сесія протухла).
        flash(SAVE_ERRORS[err?.error] || "Не збереглося — спробуйте ще раз");
        return false;
      }
      // Сервер повертає збережені дані з проставленими номерами робіт —
      // беремо їх, щоб у щойно доданої роботи одразу було видно номер.
      const saved = await res.json().catch(() => null);
      setData(saved?.data || next);
      flash("Збережено. Сайт оновлено.");
      return true;
    } catch (e) {
      flash(e.name === "TimeoutError"
        ? "Сервер не відповів. Перевірте зʼєднання."
        : "Помилка мережі. Спробуйте ще раз.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file) {
    const small = await compressImage(file);
    const form = new FormData();
    form.append("file", small);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("upload failed");
    return res.json(); // {ok, url, uploadedBy, uploadedByName, uploadedAt}
  }

  async function saveItem(kind, index, item, file) {
    try {
      setBusy(true);
      if (file) {
        const meta = await uploadPhoto(file);
        item = { ...item, img: meta.url, uploadedBy: meta.uploadedBy, uploadedByName: meta.uploadedByName, uploadedAt: meta.uploadedAt };
      }
      if (!item.img) { flash("Додайте фото"); setBusy(false); return; }
      if (!item.title.uk) { flash("Вкажіть назву"); setBusy(false); return; }

      const list = [...data[kind]];
      if (index === -1) {
        if (kind === "paintings" && !item.id) item.id = translit(item.title.uk) || `kartyna-${Date.now()}`;
        list.unshift(item); // нове — нагору, старі зсуваються вниз
      } else {
        list[index] = item;
      }
      const ok = await persist({ ...data, [kind]: list });
      if (ok) setEditing(null);
    } catch {
      setBusy(false);
      flash("Помилка завантаження фото");
    }
  }

  function move(kind, index, dir) {
    const list = [...data[kind]];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    persist({ ...data, [kind]: list });
  }

  function remove(kind, index) {
    const item = data[kind][index];
    const title = item.code ? `${item.code} ${item.title.uk}` : item.title.uk;
    if (!confirm(`Видалити «${title}»? Цю дію не можна скасувати.`)) return;
    const list = data[kind].filter((_, i) => i !== index);
    persist({ ...data, [kind]: list });
  }

  if (!data) return <div className="admin"><p className="muted">Завантаження…</p></div>;

  const kind = tab === "paintings" ? "paintings" : null;
  const view = kind ? data[kind].map((item, index) => ({ item, index })) : null;

  return (
    <div className="admin">
      <div className="admin-top">
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Адмінка сайту</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a className="link small" href="/uk" target="_blank">відкрити сайт →</a>
          <Link className="link small" href="/admin/logs">журнал подій</Link>
          {user?.name && <span className="small muted">{user.name}</span>}
          <button className="link small muted"
            onClick={() => fetch("/api/admin/logout", { method: "POST" }).then(() => location.reload())}>
            вийти
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((tb) => {
          const count = tb.id === "paintings" ? data.paintings.length
            : tb.id === "cycles" ? data.cycles.length : null;
          return (
            <button key={tb.id} className={tab === tb.id ? "active" : ""}
              onClick={() => {
                if (editing && tb.id !== tab &&
                    !confirm("Закрити форму? Незбережені зміни пропадуть.")) return;
                setTab(tb.id); setEditing(null);
              }}>
              {tb.label}{count !== null ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <details className="admin-help">
        <summary>Як додати нову роботу — коротка інструкція</summary>
        <ol>
          <li>Оберіть вкладку: куди має потрапити робота (розписи, брендинг чи картини).</li>
          <li>Натисніть «+ Додати», оберіть фото — можна одразу зняти камерою.</li>
          <li>Впишіть назву українською. Решта полів — за бажанням, їх можна доповнити пізніше.</li>
          <li>Натисніть «Зберегти» — робота з&apos;явиться на сайті за хвилину.</li>
        </ol>
        <p>Цифра зліва — місце роботи на сайті. Стрілки ↑↓ переставляють її вище або нижче,
        «змінити» відкриває текст і фото, ✕ видаляє.</p>
        <p>Код біля назви (К-014, Р-007) — постійний номер роботи. Він не змінюється
        ніколи: ні від перестановки, ні від редагування, ні від зміни категорії.
        Цей номер стоїть у темі листа про заявку — за ним одразу видно, про яку
        роботу питає клієнт.</p>
      </details>

      {TAB_HINT[tab] && <p className="admin-note" style={{ margin: "0 4px 8px" }}>{TAB_HINT[tab]}</p>}

      {tab === "authenticity" && (
        <AuthenticityTab data={data} setData={setData} persist={persist} uploadPhoto={uploadPhoto} busy={busy} />
      )}

      {tab === "cycles" && (
        <CyclesTab data={data} persist={persist} uploadPhoto={uploadPhoto} busy={busy} flash={flash} />
      )}

      {tab === "blog" && (
        <BlogTab data={data} setData={setData} persist={persist} uploadPhoto={uploadPhoto} busy={busy} />
      )}

      {tab === "hero" && (
        <HeroTab data={data} setData={setData} persist={persist} uploadPhoto={uploadPhoto} busy={busy} />
      )}

      {tab === "about" && (
        <AboutTab data={data} persist={persist} busy={busy} uploadPhoto={uploadPhoto} />
      )}

      {tab === "contacts" && (
        <div className="admin-form" style={{ maxWidth: 480 }}>
          <label>телефон
            <input value={data.contacts.phone}
              onChange={(e) => setData({ ...data, contacts: { ...data.contacts, phone: e.target.value } })} />
          </label>
          <label>email
            <input value={data.contacts.email}
              onChange={(e) => setData({ ...data, contacts: { ...data.contacts, email: e.target.value } })} />
          </label>
          <label>Instagram (повне посилання)
            <input value={data.contacts.instagram}
              onChange={(e) => setData({ ...data, contacts: { ...data.contacts, instagram: e.target.value } })} />
          </label>
          <button className="admin-save" disabled={busy} onClick={() => persist(data)}>
            {busy ? "Зберігаю…" : "Зберегти"}
          </button>
        </div>
      )}

      {view && (
        <>
          <div className="admin-add">
            {editing?.index === -1 ? null : (
              <button onClick={() => setEditing({ tab, index: -1 })}>
                + Додати картину
              </button>
            )}
          </div>

          {editing?.tab === tab && editing.index === -1 && (
            <PaintingForm busy={busy} cycles={data.cycles} onCancel={() => setEditing(null)}
              onSave={(p, f) => saveItem("paintings", -1, p, f)} />
          )}

          {view.map(({ item, index }, pos) => {
            const uploadMeta = formatUploadMeta(item);
            return (
            <div key={(item.slug || item.id) + index}>
              <div className="admin-row">
                <span className="admin-pos">{pos + 1}</span>
                <div className="admin-thumb">
                  <Image src={item.img} alt="" fill sizes="96px" style={{ objectFit: "cover" }} />
                </div>
                <div className="admin-row-title">
                  <span>
                    {item.code && <span className="admin-code">{item.code}</span>}
                    {item.title.uk}
                  </span>
                  <span className="small muted">
                    {`${item.size} см · ${STATUSES[item.status]}`}
                  </span>
                  {uploadMeta && <span className="small muted">{uploadMeta}</span>}
                </div>
                <div className="admin-actions">
                  <button title="вгору" disabled={pos === 0}
                    onClick={() => move(kind, index, -1)}>↑</button>
                  <button title="вниз" disabled={pos === view.length - 1}
                    onClick={() => move(kind, index, 1)}>↓</button>
                  <button className="act-edit" onClick={() => setEditing({ tab, index })}>змінити</button>
                  <button className="act-del" title="видалити" onClick={() => remove(kind, index)}>✕</button>
                </div>
              </div>
              {editing?.tab === tab && editing.index === index && (
                <PaintingForm initial={item} busy={busy} cycles={data.cycles} onCancel={() => setEditing(null)}
                  onSave={(p, f) => saveItem("paintings", index, p, f)} />
              )}
            </div>
            );
          })}
        </>
      )}

      {msg && <div className="admin-msg">{msg}</div>}
    </div>
  );
}
