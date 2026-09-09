// Атомарний запис JSON-файлів сховища.
//
// fs.writeFile спершу обрізає файл до нуля, а потім наповнює. Між цими
// двома моментами будь-хто, хто читає файл, дістає порожнечу або половину
// документа — і JSON.parse кидає SyntaxError. Сценарій не теоретичний:
// адмінка зберігає дані рівно тоді, коли відвідувач відкриває сторінку.
//
// Тому пишемо в сусідній тимчасовий файл і перейменовуємо його на місце
// цільового. Перейменування в межах однієї файлової системи атомарне:
// читач бачить або старий файл цілком, або новий цілком, третього стану
// нема. На Windows Node робить це через MoveFileExW з
// MOVEFILE_REPLACE_EXISTING, тобто наявний файл перезаписується без
// проміжного видалення.
//
// Чого цей приймач НЕ вирішує: двох одночасних записувачів. Обидва
// відпрацюють, переможе той, хто перейменував останнім, і зміни першого
// зникнуть. Для сайту з одним адміністратором це прийнятно; захист від
// втрачених оновлень — це вже блокування або версія документа.
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Windows не дає перейменувати файл поверх того, який хтось саме читає:
// rename падає з EPERM/EBUSY (на Linux і macOS цієї проблеми нема зовсім).
// Стандартний обхід — повторити; так само робить write-file-atomic.
//
// Бюджет міряний. 100 записів поспіль, паралельні читачі того ж файлу:
//
//   читачів  0 — 100/100 записів, усі з першої спроби, 152 мс на всі
//   читачів  1 — 100/100, потрібно 1-5 спроб, 2.4 с на всі
//   читачів  2 — 99/100
//   читачів  4 — 27/100
//
// Тобто повтори рятують від звичайної конкуренції, але не від
// насичення: коли файл відкритий практично завжди, вільного проміжку
// для rename просто не існує, і жоден бюджет тут не допоможе. Межа
// далеко за межами реального навантаження — сторінка робить одне
// читання на рендер, а не тисячі на секунду, — і стосується лише
// fs-драйвера, тобто локальної розробки: на проді працюють Netlify
// Blobs чи Vercel Blob, де ніякого rename нема. На Linux і macOS
// відкритий читач перейменуванню теж не заважає взагалі.
//
// Якщо бюджет усе-таки вичерпано, помилка летить нагору: краще чесно
// не зберегти й сказати про це, ніж писати поверх без перейменування
// й повернути ту саму гонку, заради якої весь цей файл і існує.
const RENAME_ATTEMPTS = 30;
const RENAME_DELAY_STEP_MS = 5;
const RENAME_DELAY_CAP_MS = 50;

async function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const busy = err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES";
      if (!busy || attempt >= RENAME_ATTEMPTS) throw err;
      // 5, 10, 15… до 50 мс — сумарно близько 1.3 с очікування.
      const delay = Math.min(attempt * RENAME_DELAY_STEP_MS, RENAME_DELAY_CAP_MS);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function writeFileAtomic(target, content) {
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  // Тимчасовий файл — поруч із цільовим, у тій самій теці: перейменування
  // між різними файловими системами не атомарне, а /tmp цілком може
  // виявитись іншим томом.
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await fs.open(tmp, "w");
    await handle.writeFile(content, "utf-8");
    // Без fsync дані можуть лишитись у кеші ОС: після перейменування файл
    // уже на місці, але при раптовому вимкненні живлення виявиться порожнім.
    await handle.sync();
    await handle.close();
    handle = null;
    await renameWithRetry(tmp, target);
  } catch (err) {
    if (handle) await handle.close().catch(() => {});
    // Недописаний тимчасовий файл прибираємо — інакше після кожного збою
    // в теці лишалося б сміття.
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

// Те саме, але для JSON — щоб формат (відступ 2) не розповзався по файлах.
export async function writeJsonAtomic(target, value) {
  await writeFileAtomic(target, JSON.stringify(value, null, 2));
}
