import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getData, putData } from "@/lib/store";
import { getSession, isAuthed } from "@/lib/adminAuth";
import { getClientIp } from "@/lib/rateLimit";
import { logEvent } from "@/lib/auditLog";
import { preserveCodes } from "@/lib/workCodes";
import { normalizePrice } from "@/lib/price";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await getData());
}

// Що зникло зі списку між "до" і "після" — щоб відрізнити видалення
// від звичайного редагування без окремого прапорця від клієнта.
function removedItems(beforeList, afterList, idKey) {
  const afterIds = new Set((afterList || []).map((x) => x[idKey]));
  return (beforeList || []).filter((x) => !afterIds.has(x[idKey]));
}

// blogCovers — необов'язкове поле (slug → url), але якщо клієнт його
// передав, воно має бути плоским об'єктом рядок→рядок, а не чим завгодно.
// authenticityPhotos — рівно об'єкт із рядковими значеннями (url або "").
// Undefined не пропускаємо: normalize() завжди його проставляє, тож
// його відсутність означає зіпсований запит, а не старого клієнта.
function isValidAuthPhotos(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

// hero.videoEnabled — строго boolean, hero.video — строго рядок.
// Від прапорця залежить, що бачить відвідувач на першому екрані,
// тож "true" рядком або null тут не приймаємо.
// Той самий контракт, що й для hero: прапорець — boolean, шлях — рядок.
function isValidVideoSlot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.videoEnabled !== "boolean") return false;
  if (typeof value.video !== "string") return false;
  return true;
}

function isValidHero(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.videoEnabled !== "boolean") return false;
  if (typeof value.video !== "string") return false;
  return true;
}

// Опис циклу: мапа локаль→рядок. Порожній об'єкт валідний — це
// стертий текст. undefined теж: normalize() проставить його з насіння.
function isValidCycleText(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

function isValidBlogCovers(value) {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

export async function PUT(request) {
  const session = await getSession();
  if (!session.login) return NextResponse.json({ ok: false }, { status: 401 });

  const data = await request.json().catch(() => null);

  // Перевірки названі поіменно, щоб відмова потрапляла в журнал із назвою
  // поля. Доти відхилений запит не доходив до logEvent (той у кінці
  // обробника) і не лишав жодного сліду — саме через це збій в адмінці
  // довелося ловити перехопленням fetch у браузері.
  const checks = [
    ["тіло запиту", () => Boolean(data)],
    ["paintings", () => Array.isArray(data.paintings)],
    ["cycles", () => Array.isArray(data.cycles)],
    // Перевірка йде після ["cycles"] і виконується лише якщо та пройшла:
    // find() зупиняється на першій невдачі, тож .every() тут завжди
    // працює вже з масивом.
    ["текст циклу", () => data.cycles.every((c) => isValidCycleText(c && c.text))],
    ["authenticityPhotos", () => isValidAuthPhotos(data.authenticityPhotos)],
    ["hero", () => isValidHero(data.hero)],
    ["processSection", () => isValidVideoSlot(data.processSection)],
    ["contacts", () => Boolean(data.contacts)],
    ["blogCovers", () => isValidBlogCovers(data.blogCovers)],
  ];
  const failed = checks.find(([, ok]) => !ok())?.[0];
  if (failed) {
    // Саме тіло не пишемо — там увесь вміст сайту. Лише назва перевірки.
    await logEvent({
      action: "save_rejected",
      user: session.login,
      ip: getClientIp(request),
      ua: request.headers.get("user-agent") || "",
      detail: `не пройшла перевірка: ${failed}`,
    });
    return NextResponse.json({ ok: false, error: "bad data" }, { status: 400 });
  }

  // Захист від "€" у полі ціни, навіть якщо хтось оминув адмінку й
  // надіслав запит напряму: у сховищі ціна завжди чисте число.
  // Цикл роботи — або id наявного циклу, або null. Довільний рядок
  // від клієнта не приймаємо: від нього залежить фільтр на головній.
  const cycleIds = new Set((data.cycles || []).map((c) => c && c.id));
  data.paintings = data.paintings.map((p) => ({
    ...p,
    price: normalizePrice(p.price),
    cycle: cycleIds.has(p.cycle) ? p.cycle : null,
  }));

  // id і slug циклів — тільки для читання: від slug залежать маршрути
  // /cycles/[slug] і sitemap, тож клієнт не може їх переписати.
  const before = await getData();
  const beforeCycles = new Map((before.cycles || []).map((c) => [c.id, c]));
  data.cycles = data.cycles
    .filter((c) => beforeCycles.has(c.id))
    .map((c) => ({ ...c, id: beforeCycles.get(c.id).id, slug: beforeCycles.get(c.id).slug }));
  if (!data.cycles.length) data.cycles = before.cycles;
  // Номери робіт закріплює сервер, а не клієнт: наявні беруться з
  // попередньої версії за id, новим роботам видається наступний номер
  // лічильника. Тому перестановка чи редагування номер не змінюють.
  preserveCodes(before, data);

  // Запис може не вдатися сам по собі: диск переповнено, немає прав, у
  // fs-режимі — не вийшло перейменувати тимчасовий файл (див. коментар
  // в lib/atomicWrite.js). Досі така помилка летіла з обробника нагору:
  // Next віддавав голий 500, в журналі не лишалось ані рядка, і причину
  // не було де подивитись.
  //
  // Дані при цьому не втрачені: сховище лишилось на попередній версії
  // (запис атомарний — або весь, або жоден), а нова версія цілком жива
  // в стейті браузера. Тож повертаємо помилку з кодом, а адмінка
  // просить повторити, нічого не скидаючи.
  try {
    await putData(data);
  } catch (err) {
    // Системні помилки вже починаються з коду ("EPERM: operation not
    // permitted…"), тож підставляємо його лише коли його там нема —
    // інакше в журналі виходило б "EPERM: EPERM: …".
    const code = err?.code || err?.name || "Error";
    const message = String(err?.message || err);
    await logEvent({
      action: "save_failed",
      user: session.login,
      ip: getClientIp(request),
      ua: request.headers.get("user-agent") || "",
      // Сам вміст не пишемо — там увесь сайт. Лише крок і помилка.
      detail: `putData: ${message.startsWith(code) ? message : `${code}: ${message}`}`.slice(0, 220),
    });
    // Кеш сторінок не скидаємо: на сайті нічого не змінилось.
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  // Скидаємо кеш сторінок: і згенерований Next, і статичні шляхи.
  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");

  const removedPaintings = removedItems(before.paintings, data.paintings, "id");
  const removedTitles = removedPaintings.map((x) => {
    const title = x.title?.uk || x.id;
    return x.code ? `${x.code} ${title}` : title;
  });
  const isDelete = removedTitles.length > 0;

  const detailParts = [];
  if (removedTitles.length) detailParts.push(`видалено: ${removedTitles.join(", ")}`);

  await logEvent({
    action: isDelete ? "delete" : "edit",
    user: session.login,
    ip: getClientIp(request),
    ua: request.headers.get("user-agent") || "",
    detail: detailParts.join("; ") || null,
  });

  // Повертаємо збережені дані назад: у нових робіт щойно з'явився номер,
  // і адмінка має показати саме його, а не перезавантажуватись.
  return NextResponse.json({ ok: true, data });
}
