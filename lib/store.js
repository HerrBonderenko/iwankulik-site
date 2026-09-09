// Сховище даних сайту з трьома драйверами:
//  - Netlify Blobs, коли IS_NETLIFY_BUILD (зафіксовано під час збірки — див.
//    next.config.mjs; process.env.NETLIFY доступний лише на build, у рантаймі
//    Server Handler його вже нема)
//  - Vercel Blob, коли задано BLOB_READ_WRITE_TOKEN (хмара, Vercel)
//  - локальні файли content/data.json + content/uploads (свій сервер, розробка)
// Першого разу сховище засівається даними з data/site.js.

import fs from "fs/promises";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { readJsonFile, quarantineJsonFile, isBroken } from "@/lib/jsonFile";
import { assignCodes } from "@/lib/workCodes";
// Стор і ключ — з окремого .mjs, бо ті самі значення потрібні
// scripts/push-data.mjs і scripts/pull-data.mjs, які виконує голий node.
import { STORE_NAME, DATA_KEY } from "@/lib/siteData.mjs";
import { paintings as seedPaintings, contacts as seedContacts, hero as seedHero, about as seedAbout, homeCount as seedHomeCount, counters as seedCounters, cycles as seedCycles, authenticityPhotos as seedAuthPhotos, processSection as seedProcess } from "@/data/site";

const DRIVER = process.env.IS_NETLIFY_BUILD ? "netlify" : process.env.BLOB_READ_WRITE_TOKEN ? "vercel" : "fs";
export const IS_NETLIFY = DRIVER === "netlify";
const FS_DATA = path.join(process.cwd(), "content", "data.json");

function seed() {
  return normalize({ paintings: seedPaintings, contacts: seedContacts, hero: seedHero, about: seedAbout, homeCount: seedHomeCount, counters: seedCounters, cycles: seedCycles, authenticityPhotos: seedAuthPhotos, processSection: seedProcess });
}

function normalize(data) {
  // Обкладинка головної могла лишитися з видалених розписів — тоді
  // файлу вже нема, і замість фото був би 404. Повертаємось на сід.
  if (!data.hero || !data.hero.img || data.hero.img.startsWith("/assets/mural-")) data.hero = seedHero;
  // Прапорець відео в героя міг не існувати у старих збережених даних.
  // Вимкнено за замовчуванням: краще показати саме лише фото, ніж
  // випадково ввімкнути чуже відео.
  data.hero.videoEnabled = data.hero.videoEnabled === true;
  if (typeof data.hero.video !== "string") data.hero.video = "";
  // Те саме для відео в секції «Процес».
  if (!data.processSection || typeof data.processSection !== "object" || Array.isArray(data.processSection)) {
    data.processSection = { ...seedProcess };
  }
  data.processSection.videoEnabled = data.processSection.videoEnabled === true;
  if (typeof data.processSection.video !== "string") data.processSection.video = "";
  if (!data.about || !data.about.text) data.about = seedAbout;
  // Розписи прибрані з сайту — старі збережені дані можуть їх ще містити.
  delete data.murals;
  delete data.categories;
  if (!Number.isInteger(data.homeCount)) data.homeCount = seedHomeCount;
  // Цикли з'явилися пізніше за решту сховища — досіваємо старим записам.
  // Набір циклів сталий (від нього залежать маршрути /cycles/[slug]),
  // тож редагується лише вміст, а не склад списку.
  if (!Array.isArray(data.cycles) || !data.cycles.length) data.cycles = seedCycles;
  // Опис циклу (text) з'явився пізніше за самі цикли, а рядок вище міняє
  // масив лише коли його нема зовсім — у вже збережених даних поле так і
  // лишилося б порожнім. Тож досіваємо поштучно, за id. Порожній об'єкт
  // не чіпаємо: це навмисно стертий в адмінці текст, а не відсутнє поле.
  const seedCycleById = new Map(seedCycles.map((c) => [c.id, c]));
  data.cycles = data.cycles.map((c) => {
    if (!c || typeof c !== "object") return c;
    if (c.text && typeof c.text === "object" && !Array.isArray(c.text)) return c;
    return { ...c, text: seedCycleById.get(c.id)?.text || {} };
  });
  // Фото секції «Автентичність»: три необов'язкові слоти. Досіваємо
  // так само, як cycles, і добиваємо відсутні ключі поодинці —
  // щоб додавання четвертого слота не вимагало міграції сховища.
  if (!data.authenticityPhotos || typeof data.authenticityPhotos !== "object" || Array.isArray(data.authenticityPhotos)) {
    data.authenticityPhotos = { ...seedAuthPhotos };
  } else {
    data.authenticityPhotos = { ...seedAuthPhotos, ...data.authenticityPhotos };
  }
  // Оверрайди обкладинок статей блогу (slug → url завантаженого фото) —
  // з'явилися пізніше за решту сховища, тож досіваємо старим записам.
  if (!data.blogCovers || typeof data.blogCovers !== "object" || Array.isArray(data.blogCovers)) {
    data.blogCovers = {};
  }
  // Alt-описи цих обкладинок (slug -> {локаль: текст}). Потрібні саме для
  // завантажених файлів: у вбудованих обкладинок опис бере lib/coverAlt.js
  // за іменем файлу, а /uploads/… там бути не може.
  if (!data.blogCoverAlts || typeof data.blogCoverAlts !== "object" || Array.isArray(data.blogCoverAlts)) {
    data.blogCoverAlts = {};
  }
  // Прив'язка роботи до циклу з'явилася пізніше за самі роботи —
  // старим записам проставляємо null, а неіснуючий id циклу гасимо,
  // інакше фільтр на головній показав би порожню кнопку.
  if (Array.isArray(data.paintings)) {
    const known = new Set((data.cycles || []).map((c) => c.id));
    for (const p of data.paintings) {
      if (!p || typeof p !== "object") continue;
      p.cycle = known.has(p.cycle) ? p.cycle : null;
    }
  }
  // Постійні номери робіт (К-014) з'явилися пізніше — досіваємо
  // старим роботам за поточним порядком. Функція детермінована, тож
  // до першого збереження з адмінки кожне читання дає ті самі номери,
  // а перше збереження їх фіксує в сховищі.
  assignCodes(data);
  return data;
}

// list() у Vercel Blob — платна Advanced Operation з лімітом
// 2000/міс. Раніше викликали її на кожне відкриття сторінки, щоб
// дізнатись адресу файлу — ліміт танув просто від відвідувачів.
// Адреса файлу з даними не змінюється (allowOverwrite), тож
// запитуємо її через list() лише раз на "холодний старт" функції
// і тримаємо в пам'яті процесу — це вже кілька разів на добу,
// а не на кожен візит.
let cachedUrl = null;

async function getBlobUrl() {
  if (cachedUrl) return cachedUrl;
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: DATA_KEY, limit: 1 });
  cachedUrl = blobs[0]?.url || null;
  return cachedUrl;
}

export async function getNetlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

// Останні успішно прочитані дані цього процесу. Потрібні тоді, коли
// читання зламалось: віддати сід означало б показати відвідувачеві
// демо-вміст замість справжніх робіт — тихо й непомітно. Кеш живе лише
// в пам'яті процесу й зникає на холодному старті; це запобіжник на час
// збою, а не кеш заради швидкості (на успішному шляху він не читається).
let lastGood = null;

// Читає сховище як є. null означає "сховища ще нема" — нормальний стан
// першого запуску, на нього відповідаємо сідом без жодних скарг.
// Будь-яка інша біда (обірваний JSON, недоступне сховище) летить
// винятком нагору, до getData — щоб її було видно, а не сплутано з
// порожнім сховищем.
async function readStored() {
  if (DRIVER === "netlify") {
    const store = await getNetlifyStore();
    // type: "json" всередині робить JSON.parse — на недописаному блобі
    // він кине SyntaxError, і це саме те, що нам треба побачити.
    return (await store.get(DATA_KEY, { type: "json" })) ?? null;
  }
  if (DRIVER === "vercel") {
    const url = await getBlobUrl();
    if (!url) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Vercel Blob відповів ${res.status}`);
    const data = await res.json();
    // Мітка версії, яку сам записав putData, обходить кеш CDN
    // при наступному читанні — без повторного list().
    if (!data.__v) return data;
    const stamped = await fetch(`${url}?v=${data.__v}`, { cache: "no-store" });
    // Свіжішу версію не дістали — краще віддати ту, що вже в руках,
    // ніж впасти: вона валідна, просто могла бути з кешу CDN.
    return stamped.ok ? await stamped.json() : data;
  }
  let raw;
  try {
    raw = await fs.readFile(FS_DATA, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  return JSON.parse(raw);
}

// Скарги в журнал не частіше ніж раз на хвилину: якщо файл побився,
// зламається кожен рендер підряд, і журнал заповнився б тисячею
// однакових рядків замість одного зрозумілого.
let lastReportAt = 0;
const REPORT_EVERY_MS = 60_000;

async function reportStorageFailure(err) {
  console.error("[store] Не вдалося прочитати сховище:", err);
  const now = Date.now();
  if (now - lastReportAt < REPORT_EVERY_MS) return;
  lastReportAt = now;
  try {
    // Динамічний імпорт, а не звичайний: auditLog сам імпортує зі store
    // (IS_NETLIFY, getNetlifyStore), і статичний імпорт замкнув би цикл
    // на етапі ініціалізації модулів. Тут же він виконується лише в
    // момент збою, коли обидва модулі давно завантажені.
    const { logEvent } = await import("@/lib/auditLog");
    await logEvent({
      action: "storage_error",
      user: null,
      ip: null,
      ua: null,
      detail: `${DRIVER}: ${err?.name || "Error"}: ${String(err?.message || err).slice(0, 200)}`,
    });
  } catch (logErr) {
    // Журнал лежить у тому самому сховищі — якщо не дописався, лишається
    // консоль. Падати через невдалий запис у журнал точно не варто.
    console.error("[store] і в журнал записати не вдалося:", logErr);
  }
}

export async function getData() {
  try {
    const data = await readStored();
    if (data === null) return seed();
    const normalized = normalize(data);
    lastGood = normalized;
    return normalized;
  } catch (err) {
    await reportStorageFailure(err);
    // Останнє валідне значення цього процесу, а якщо його ще нема —
    // сід. У будь-якому разі сторінка віддається, процес живий.
    return lastGood || seed();
  }
}

export async function putData(data) {
  if (DRIVER === "netlify") {
    const store = await getNetlifyStore();
    await store.setJSON(DATA_KEY, data);
    return;
  }
  if (DRIVER === "vercel") {
    const { put } = await import("@vercel/blob");
    const stamped = { ...data, __v: Date.now() };
    await put(DATA_KEY, JSON.stringify(stamped, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }
  // Через тимчасовий файл із перейменуванням: інакше рендер сторінки,
  // що трапився посеред збереження, прочитав би обрізаний файл.
  await writeJsonAtomic(FS_DATA, data);
}

// meta.originalName — початкове ім'я файлу, як його назвав відвідувач/
// адмінка, до перегенерації через sharp і сатанізації в "name". Ніколи
// не стає частиною самого шляху — лише метадані для довідки.
export async function saveImage(buffer, filename, contentType, meta = {}) {
  const safe = filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const name = `${Date.now()}-${safe}`;
  if (DRIVER === "netlify") {
    const store = await getNetlifyStore();
    await store.set(`uploads/${name}`, buffer, { metadata: { contentType, originalName: filename, ...meta } });
    return `/uploads/${name}`;
  }
  if (DRIVER === "vercel") {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`uploads/${name}`, buffer, {
      access: "public",
      contentType,
    });
    return url;
  }
  const dir = path.join(process.cwd(), "content", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  // fs-режим не має власного сховища метаданих — тримаємо поруч, файл на файл.
  const metaPath = path.join(dir, "meta.json");
  // Той самий цикл read-modify-write, що й у лічильників: у файлі
  // метадані всіх раніше завантажених картинок, і побитий файл не
  // можна приймати за порожній.
  const { value: all, state } = await readJsonFile(metaPath, {});
  if (isBroken(state)) await quarantineJsonFile(metaPath);
  all[name] = { contentType, originalName: filename, ...meta };
  await writeJsonAtomic(metaPath, all);
  return `/uploads/${name}`;
}

export async function getUploadedImage(name) {
  if (DRIVER !== "netlify") return null;
  const store = await getNetlifyStore();
  const data = await store.get(`uploads/${name}`, { type: "arrayBuffer" });
  return data ? Buffer.from(data) : null;
}
