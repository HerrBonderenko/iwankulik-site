// Категорії блогу: назви й локалізовані слаги.
// Окремо від lib/blog.js навмисно: той тягне node:fs і gray-matter, тож
// у клієнтський бандл не потрапить, а ця таблиця потрібна саме там —
// перемикачу мов у шапці, щоб перекласти слаг категорії в адресі.

export const CATEGORIES = {
  cycles: {
    uk: "Цикли",
    ru: "Циклы",
    en: "Cycles",
    pl: "Cykle",
    de: "Zyklen",
    slug: { uk: "tsykly", ru: "tsikly", en: "cycles", pl: "cykle", de: "zyklen" },
  },
  technique: {
    uk: "Техніка",
    ru: "Техника",
    en: "Technique",
    pl: "Technika",
    de: "Technik",
    slug: { uk: "tehnika", ru: "tehnika", en: "technique", pl: "technika", de: "technik" },
  },
  collecting: {
    uk: "Колекціонування",
    ru: "Коллекционирование",
    en: "Collecting",
    pl: "Kolekcjonowanie",
    de: "Sammeln",
    slug: { uk: "kolektsionuvannia", ru: "kollektsionirovanie", en: "collecting", pl: "kolekcjonowanie", de: "sammeln" },
  },
  artist: {
    uk: "Про художника",
    ru: "О художнике",
    en: "About the Artist",
    pl: "O artyście",
    de: "Über den Künstler",
    slug: { uk: "pro-hudozhnyka", ru: "o-hudozhnike", en: "about-the-artist", pl: "o-artyscie", de: "ueber-den-kuenstler" },
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export function categoryName(key, locale) {
  return CATEGORIES[key]?.[locale] ?? key;
}

export function categorySlug(key, locale) {
  return CATEGORIES[key]?.slug[locale] ?? key;
}

// Зворотній пошук: локалізований сегмент URL → канонічний ключ категорії.
export function categoryKeyFromSlug(locale, slug) {
  return CATEGORY_KEYS.find((key) => CATEGORIES[key].slug[locale] === slug) ?? null;
}

// Той самий пошук серед слагів усіх мов. Потрібен proxy.js: /de/blog/tsykly —
// українська адреса категорії, відкрита німецькою, і її треба перевести на
// /de/blog/zyklen, а не віддати 404. Колізій нема: однаковий слаг у двох
// мовах (tehnika в uk і ru) належить одній і тій самій категорії.
export function categoryKeyFromAnySlug(slug) {
  return CATEGORY_KEYS.find((key) => Object.values(CATEGORIES[key].slug).includes(slug)) ?? null;
}
