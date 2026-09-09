#!/usr/bin/env node
// Заливає локальний content/data.json у Netlify Blobs проду —
// у той самий стор і ключ, які читає сайт (lib/siteData.mjs).
//
// ЗАПУСК
//   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node scripts/push-data.mjs --confirm
//   node scripts/push-data.mjs --site-id=... --token=... --confirm
//   node scripts/push-data.mjs --dry-run     # усе, крім запису
//
// Без --confirm скрипт спитає підтвердження з клавіатури й не напише
// нічого, поки не отримає відповідь. Випадково він не спрацює.
//
// ДЕ ВЗЯТИ ДОСТУПИ
//   NETLIFY_SITE_ID — Netlify → потрібний сайт → Site configuration →
//     General → Site information → рядок "Site ID" (виглядає як UUID).
//   NETLIFY_AUTH_TOKEN — Netlify → аватар угорі праворуч → User settings →
//     Applications → Personal access tokens → New access token.
//     Значення показують один раз, після закриття його вже не побачиш.
//
// ПРО ТОКЕН
//   Передавати краще змінною оточення, а не аргументом: аргументи
//   осідають в історії оболонки й видні в списку процесів. Скрипт токен
//   ніколи не друкує — ані в підсумку, ані в тексті помилки.
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { getStore } from "@netlify/blobs";
import { STORE_NAME, DATA_KEY, validateSiteData, summarizeSiteData } from "../lib/siteData.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_FILE = path.join(ROOT, "content", "data.json");

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

// Токен і siteID отримуємо однаково: спершу аргумент, потім оточення.
function credentials() {
  const siteID = arg("site-id") || process.env.NETLIFY_SITE_ID;
  const token = arg("token") || process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) {
    console.error(
      "Не задано доступи. Потрібні NETLIFY_SITE_ID і NETLIFY_AUTH_TOKEN\n" +
        "(або --site-id=... і --token=...). Де їх узяти — у шапці цього файлу."
    );
    process.exit(1);
  }
  if (arg("token")) {
    console.warn("Увага: токен переданий аргументом — він лишиться в історії оболонки.\n");
  }
  return { siteID, token };
}

function printSummary(label, data) {
  const s = summarizeSiteData(data);
  if (!s) {
    console.log(`${label}: даних немає`);
    return;
  }
  console.log(`${label}:`);
  console.log(`  роботи             ${s.paintings} (з ціною: ${s.withPrice})`);
  console.log(
    `  цикли              ${s.cycles}` +
      (s.cycleLocales.length ? ` (тексти: ${s.cycleLocales.join(", ")})` : " (тексти з data/site.js)")
  );
  console.log(`  hero               ${s.hero ? "є" : "нема"}`);
  console.log(`  about              ${s.about ? "є" : "нема"}`);
  console.log(`  contacts           ${s.contacts ? "є" : "нема"}`);
  console.log(`  обкладинки блогу   ${s.blogCovers}`);
  console.log(`  фото автентичності ${s.authenticityPhotos}`);
}

async function confirm(existing) {
  if (hasFlag("confirm")) return true;
  if (!process.stdin.isTTY) {
    console.error("Немає --confirm, а спитати нема кого (не інтерактивний запуск). Зупиняюсь.");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const word = existing ? "ПЕРЕЗАПИСАТИ" : "ЗАЛИТИ";
  const answer = await rl.question(`\nНапишіть ${word}, щоб продовжити: `);
  rl.close();
  return answer.trim() === word;
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const { siteID, token } = credentials();

  // 1. Локальний файл.
  let local;
  try {
    local = JSON.parse(await fs.readFile(LOCAL_FILE, "utf-8"));
  } catch (err) {
    console.error(`Не вдалося прочитати ${LOCAL_FILE}: ${err.message}`);
    process.exit(1);
  }

  // 2. Ті самі правила, що й в адмінці (app/api/admin/data/route.js).
  const failed = validateSiteData(local);
  if (failed) {
    console.error(`Локальні дані не пройшли перевірку: ${failed}. Нічого не залито.`);
    process.exit(1);
  }

  printSummary("Локальні дані (звідки)", local);

  // 3. Що вже лежить на проді.
  const store = getStore({ name: STORE_NAME, siteID, token, consistency: "strong" });
  let existing = null;
  try {
    existing = await store.get(DATA_KEY, { type: "json" });
  } catch (err) {
    console.error(`\nНе вдалося прочитати поточні дані з Blobs: ${err.message}`);
    console.error("Перевірте siteID і права токена. Нічого не залито.");
    process.exit(1);
  }

  console.log();
  if (existing) {
    printSummary("На проді зараз (куди)", existing);
    console.log("\n⚠  Ці дані будуть ПЕРЕЗАПИСАНІ цілком. Скасувати запис не можна.");
    console.log("   Спершу зробіть копію: node scripts/pull-data.mjs");
  } else {
    console.log("На проді зараз: сховище порожнє (сайт віддає насіння з data/site.js).");
  }

  if (dryRun) {
    console.log("\n--dry-run: запис не виконувався.");
    return;
  }

  if (!(await confirm(existing))) {
    console.log("Скасовано, нічого не залито.");
    process.exit(1);
  }

  await store.setJSON(DATA_KEY, local);

  // 4. Перечитуємо те, що записали, — щоб у підсумку стояли дані
  //    зі сховища, а не наші наміри.
  const written = await store.get(DATA_KEY, { type: "json" });
  console.log();
  printSummary("Залито, на проді тепер", written);
  console.log(`\nКлюч: ${STORE_NAME}/${DATA_KEY}`);
  console.log("Сторінки оновляться протягом хвилини (revalidate = 60).");
}

main().catch((err) => {
  // Повідомлення помилок Netlify не містять токена, але на випадок
  // майбутніх змін бібліотеки друкуємо лише message, не весь об'єкт.
  console.error(`Помилка: ${err?.message || err}`);
  process.exit(1);
});
