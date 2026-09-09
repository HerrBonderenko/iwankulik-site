// Стійке читання JSON-файлів сховища.
//
// Парна до atomicWrite.js половина задачі. Той приймач гарантує, що
// читач ніколи не побачить половину документа, — але лише поки пишуть
// саме через нього. Файл усе одно може виявитись непридатним: обірваний
// запис старої версії, збій диска, правка руками. Тому кожне читання
// розрізняє три стани, а не два:
//
//   missing    — файлу нема. Нормальний перший запуск, мовчимо.
//   corrupt    — файл є, але це не JSON. Скарга в консоль.
//   unreadable — файл є, але не дався (права, диск). Скарга в консоль.
//
// Різниця між "нема" й "побитий" принципова для тих, хто читає файл,
// щоб тут-таки його переписати (лічильники rate-limit, відомі пристрої):
// прийняти побитий файл за порожній означає стерти всі чужі записи.
import fs from "fs/promises";
import path from "path";

/**
 * @returns {Promise<{value: any, state: "ok"|"missing"|"corrupt"|"unreadable"}>}
 * value на будь-якому невдалому стані — переданий fallback, тож
 * викликач може не перевіряти state, якщо йому досить значення.
 */
export async function readJsonFile(file, fallback) {
  let raw;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return { value: fallback, state: "missing" };
    console.error(`[jsonFile] ${file} не читається:`, err);
    return { value: fallback, state: "unreadable" };
  }
  try {
    return { value: JSON.parse(raw), state: "ok" };
  } catch (err) {
    console.error(`[jsonFile] ${file} містить не JSON:`, err);
    return { value: fallback, state: "corrupt" };
  }
}

/**
 * Відсуває непридатний файл убік перед тим, як писати на його місце.
 *
 * Потрібно там, де читання — це початок циклу read-modify-write. Просто
 * писати поверх не можна: у файлі лежали чужі записи, і ми їх не бачимо.
 * Просто відмовитись писати теж не можна: тоді rate-limit чи журнал
 * лишаться зламаними назавжди. Тому файл перейменовується — вміст
 * зберігається для розбору, а наступне читання дає чесний "missing",
 * і сховище саме повертається до робочого стану.
 *
 * Викликати слід лише зі шляху запису: читання сторінки нічого в
 * файловій системі рухати не повинно.
 */
export async function quarantineJsonFile(file) {
  const target = `${file}.corrupt-${Date.now()}`;
  try {
    await fs.rename(file, target);
    console.error(`[jsonFile] ${file} відкладено як ${path.basename(target)}, починаємо з чистого`);
    return target;
  } catch (err) {
    // Не вийшло відкласти — писати поверх усе одно не будемо, хай
    // краще лишиться як є: втратити чужі записи гірше, ніж пропустити
    // один свій.
    console.error(`[jsonFile] не вдалося відкласти ${file}:`, err);
    return null;
  }
}

// Чи означає цей стан, що файл треба відкласти перед записом.
export function isBroken(state) {
  return state === "corrupt" || state === "unreadable";
}
