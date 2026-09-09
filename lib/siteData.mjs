// Контракт даних сайту: де вони лежать у Netlify Blobs і що вважається
// валідним вмістом. Єдине джерело правди для двох дуже різних місць —
// адмінки (app/api/admin/data/route.js, всередині Next) і скриптів
// scripts/push-data.mjs та scripts/pull-data.mjs (звичайний node).
//
// Розширення .mjs навмисне: у package.json немає "type": "module", тож
// для голого node будь-який .js у цьому проєкті — CommonJS, і скрипт не
// зміг би імпортувати звідси нічого. Next імпортує .mjs без застережень.
// Через це ж тут немає жодного import: модуль має лишатися придатним
// обом середовищам, тому — ні "@/" аліасів, ні server-only.

// Стор і ключ, якими користується lib/store.js. Скрипти беруть їх звідси,
// щоб заливка не промазала повз те, що читає сайт.
export const STORE_NAME = "site";
export const DATA_KEY = "data/site-data.json";

// authenticityPhotos — рівно об'єкт із рядковими значеннями (url або "").
// Undefined не пропускаємо: normalize() завжди його проставляє, тож
// його відсутність означає зіпсовані дані, а не старого клієнта.
export function isValidAuthPhotos(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

// hero і processSection мають однаковий контракт: прапорець — строго
// boolean, шлях — строго рядок. Від прапорця залежить, що бачить
// відвідувач на першому екрані, тож "true" рядком або null тут не
// приймаємо.
export function isValidVideoSlot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.videoEnabled !== "boolean") return false;
  if (typeof value.video !== "string") return false;
  return true;
}

// Окрема назва лишається, бо в переліку перевірок поле зветься "hero" і
// саме ця назва потрапляє в журнал при відмові.
export const isValidHero = isValidVideoSlot;

// Опис циклу: мапа локаль→рядок. Порожній об'єкт валідний — це стертий
// текст. undefined теж: normalize() проставить його з насіння.
export function isValidCycleText(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

// blogCovers — необов'язкове поле (slug → url), але якщо воно є, то має
// бути плоским об'єктом рядок→рядок, а не чим завгодно.
export function isValidBlogCovers(value) {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

// Назва першої перевірки, що не пройшла, або null. Перевірки названі
// поіменно, щоб відмова потрапляла в журнал із назвою поля, а не голим
// «bad data».
//
// Порядок важливий: перевірка тексту циклів іде після ["cycles"] і
// виконується лише якщо та пройшла — find() зупиняється на першій
// невдачі, тож .every() там завжди працює вже з масивом.
export function validateSiteData(data) {
  const checks = [
    ["тіло запиту", () => Boolean(data)],
    ["paintings", () => Array.isArray(data.paintings)],
    ["cycles", () => Array.isArray(data.cycles)],
    ["текст циклу", () => data.cycles.every((c) => isValidCycleText(c && c.text))],
    ["authenticityPhotos", () => isValidAuthPhotos(data.authenticityPhotos)],
    ["hero", () => isValidHero(data.hero)],
    ["processSection", () => isValidVideoSlot(data.processSection)],
    ["contacts", () => Boolean(data.contacts)],
    ["blogCovers", () => isValidBlogCovers(data.blogCovers)],
  ];
  return checks.find(([, ok]) => !ok())?.[0] ?? null;
}

// Короткий зміст даних — те, що скрипти показують до і після запису,
// щоб було видно, що саме поїхало на прод.
export function summarizeSiteData(data) {
  if (!data || typeof data !== "object") return null;
  const paintings = Array.isArray(data.paintings) ? data.paintings : [];
  const cycles = Array.isArray(data.cycles) ? data.cycles : [];
  // Ціна у сховищі — «чисте число-рядок» без валюти (див. lib/price.js),
  // тож рахуємо непорожні, а не числа. Тут навмисно проста перевірка:
  // це рядок для звіту, канонічний normalizePrice живе в lib/price.js.
  const withPrice = paintings.filter((p) => String(p?.price ?? "").replace(/[^\d]/g, "") !== "").length;
  // Тексти циклів у сховищі можуть бути відсутні — тоді normalize() у
  // lib/store.js досіває їх з data/site.js при читанні. Порожній перелік
  // локалей тут означає «беруться з насіння», а не «текстів нема на сайті».
  const cycleLocales = new Set();
  for (const c of cycles) {
    for (const loc of Object.keys(c?.text || {})) {
      if (c.text[loc]) cycleLocales.add(loc);
    }
  }
  return {
    paintings: paintings.length,
    withPrice,
    cycles: cycles.length,
    cycleLocales: [...cycleLocales].sort(),
    hero: Boolean(data.hero?.img || data.hero?.video),
    about: Boolean(data.about?.text),
    contacts: Boolean(data.contacts),
    blogCovers: Object.keys(data.blogCovers || {}).length,
    authenticityPhotos: Object.values(data.authenticityPhotos || {}).filter(Boolean).length,
  };
}
