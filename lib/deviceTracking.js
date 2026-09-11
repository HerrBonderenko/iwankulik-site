// Відомі пристрої (IP-підмережа + User-Agent) для сповіщення про вхід
// з нового пристрою. Той самий Netlify Blobs store, що й lib/store.js;
// у fs-режимі — окремий файл.
import "server-only";
import crypto from "crypto";
import path from "path";
import { writeJsonAtomic } from "@/lib/atomicWrite";
import { readJsonFile, quarantineJsonFile, isBroken } from "@/lib/jsonFile";
import { IS_NETLIFY, getNetlifyStore } from "@/lib/store";

const KEY_PREFIX = "known-devices/";
const MAX_DEVICES = 20;
const FS_FILE = path.join(process.cwd(), "content", "known-devices.json");

function ipPrefix(ip) {
  const parts = String(ip || "").split(".");
  return parts.length >= 4 ? parts.slice(0, 3).join(".") : String(ip || "");
}

function computeFingerprint(ip, ua) {
  return crypto.createHash("sha256").update(`${ipPrefix(ip)}|${ua || ""}`).digest("hex");
}

async function readDevices(login) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    try {
      return (await store.get(`${KEY_PREFIX}${login}`, { type: "json" })) || [];
    } catch (err) {
      // Порожній список означає «пристрій новий» — прийде зайвий лист
      // про вхід. Це рівно та помилка, яку варто робити в цей бік.
      console.error(`[deviceTracking] список пристроїв ${login} не читається:`, err);
      return [];
    }
  }
  const { value } = await readJsonFile(FS_FILE, {});
  return value[login] || [];
}

async function writeDevices(login, list) {
  if (IS_NETLIFY) {
    const store = await getNetlifyStore();
    await store.setJSON(`${KEY_PREFIX}${login}`, list);
    return;
  }
  // Як і в rateLimit: у файлі лежать пристрої інших користувачів,
  // тож побитий файл не можна приймати за порожній.
  const { value: all, state } = await readJsonFile(FS_FILE, {});
  if (isBroken(state)) {
    const moved = await quarantineJsonFile(FS_FILE);
    if (!moved) return;
  }
  all[login] = list;
  await writeJsonAtomic(FS_FILE, all);
}

// Повертає true, якщо пристрій новий, і одразу запам'ятовує/оновлює його.
// Максимум MAX_DEVICES на користувача — найстаріші витісняються.
export async function checkAndRememberDevice(login, ip, ua) {
  const fingerprint = computeFingerprint(ip, ua);
  const now = new Date().toISOString();
  const devices = await readDevices(login);
  const existing = devices.find((d) => d.fingerprint === fingerprint);
  if (existing) {
    existing.lastSeen = now;
    await writeDevices(login, devices);
    return false;
  }
  devices.push({ fingerprint, firstSeen: now, lastSeen: now });
  while (devices.length > MAX_DEVICES) devices.shift();
  await writeDevices(login, devices);
  return true;
}
