#!/usr/bin/env node
// Забирає дані сайту з Netlify Blobs і кладе у файл із датою.
// Потрібен для двох речей: зробити копію проду перед заливкою
// (scripts/push-data.mjs) і забрати те, що Іван наредагував в адмінці.
//
// ЗАПУСК
//   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node scripts/pull-data.mjs
//   node scripts/pull-data.mjs --site-id=... --token=... --out=шлях.json
//
// Доступи — ті самі, що й для push-data.mjs, і беруться там само
// (див. шапку того файлу: Site configuration → General → Site ID,
// User settings → Applications → Personal access tokens).
//
// Пише у content/backups/data-РРРР-ММ-ДД-ГГХХСС.json. Поверх
// content/data.json не пише навмисно — інакше одна неуважна команда
// стерла б локальну роботу; спроба вказати цей шлях через --out
// відхиляється.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStore } from "@netlify/blobs";
import { STORE_NAME, DATA_KEY, summarizeSiteData, validateSiteData } from "../lib/siteData.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_FILE = path.join(ROOT, "content", "data.json");
const BACKUP_DIR = path.join(ROOT, "content", "backups");

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const siteID = arg("site-id") || process.env.NETLIFY_SITE_ID;
  const token = arg("token") || process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) {
    console.error(
      "Не задано доступи. Потрібні NETLIFY_SITE_ID і NETLIFY_AUTH_TOKEN\n" +
        "(або --site-id=... і --token=...). Де їх узяти — у шапці scripts/push-data.mjs."
    );
    process.exit(1);
  }

  const out = arg("out") ? path.resolve(arg("out")) : path.join(BACKUP_DIR, `data-${stamp()}.json`);
  if (out === LOCAL_FILE) {
    console.error("Поверх content/data.json цей скрипт не пише — вкажіть інший --out.");
    process.exit(1);
  }

  const store = getStore({ name: STORE_NAME, siteID, token, consistency: "strong" });
  const data = await store.get(DATA_KEY, { type: "json" });

  if (data === null) {
    console.log(`Сховище порожнє: ключа ${STORE_NAME}/${DATA_KEY} немає.`);
    console.log("Сайт у такому стані віддає насіння з data/site.js. Файл не створено.");
    return;
  }

  const s = summarizeSiteData(data);
  console.log("Забрано з проду:");
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

  // Копію зберігаємо в будь-якому разі — навіть якщо дані не проходять
  // перевірку. Саме тоді вона й потрібна найбільше; просто скажемо про це.
  const failed = validateSiteData(data);
  if (failed) console.log(`\n⚠  Дані з проду не проходять перевірку: ${failed}`);

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\nЗбережено: ${path.relative(ROOT, out).split(path.sep).join("/")}`);
}

main().catch((err) => {
  console.error(`Помилка: ${err?.message || err}`);
  process.exit(1);
});
