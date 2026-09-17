// Піднімає зібраний застосунок для інтеграційних тестів.
//
// Два сервери з однієї збірки:
//   primary — із VERCEL=1: довірений заголовок адреси є, лімітери працюють;
//   bare    — без жодної платформи: тут перевіряємо, що відмова лімітера
//             ГУЧНА, а не мовчазна (аудит, R-02).
//
// Сховище обох — окремі тимчасові теки (CONTENT_DIR), робоча копія
// розробника в content/ не зачіпається. RESEND_API_KEY не задається
// навмисно: пошта повертає {skipped:true} і не робить запитів назовні.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, createWriteStream } from "node:fs";
import { randomBytes } from "node:crypto";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

const ROOT = path.resolve(".");
const children = [];
const tmpDirs = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitReady(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Сервер ${url} не піднявся за ${timeoutMs} мс`);
}

function startServer({ port, env, logFile }) {
  // detached — щоб у teardown убити всю групу процесів: next start
  // породжує next-server окремим процесом, і SIGKILL самому npx його
  // не зачіпає (перевірено вручну під час аудиту).
  const child = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const out = createWriteStream(logFile);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  children.push(child);
  return child;
}

export default async function setup({ provide }) {
  // Збірка потрібна одна; у CI вона вже виконана окремим кроком.
  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.log("[tests] .next немає — збираю (це разово, кілька хвилин)…");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  }

  const password = "audit-test-password";
  const hash = await bcrypt.hash(password, 4); // низький cost — лише для тестів
  const common = {
    SESSION_SECRET: randomBytes(24).toString("hex"),
    ADMIN_USERS: JSON.stringify([{ login: "audit", name: "Audit", hash }]),
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    MAIL_FROM: "audit@example.invalid",
    MAIL_TO_ADMIN: "admin@example.invalid",
    MAIL_TO_INQUIRY: "inquiry@example.invalid",
  };

  const primaryDir = mkdtempSync(path.join(os.tmpdir(), "iwankulik-test-"));
  const bareDir = mkdtempSync(path.join(os.tmpdir(), "iwankulik-test-bare-"));
  tmpDirs.push(primaryDir, bareDir);

  const primaryPort = await freePort();
  const barePort = await freePort();
  const bareLogFile = path.join(bareDir, "server-log.txt");

  startServer({
    port: primaryPort,
    env: { ...common, CONTENT_DIR: primaryDir, VERCEL: "1" },
    logFile: path.join(primaryDir, "server-log.txt"),
  });
  startServer({
    port: barePort,
    env: { ...common, CONTENT_DIR: bareDir },
    logFile: bareLogFile,
  });

  await waitReady(`http://127.0.0.1:${primaryPort}/uk`);
  await waitReady(`http://127.0.0.1:${barePort}/uk`);

  provide("baseUrl", `http://127.0.0.1:${primaryPort}`);
  provide("bareUrl", `http://127.0.0.1:${barePort}`);
  provide("contentDir", primaryDir);
  provide("bareContentDir", bareDir);
  provide("bareLogFile", bareLogFile); // його читає тест R-02
  provide("adminPassword", password);

  return async function teardown() {
    for (const c of children) {
      // Мінус PID — сигнал всій групі процесів (detached вище).
      try { process.kill(-c.pid, "SIGKILL"); } catch {}
      try { c.kill("SIGKILL"); } catch {}
    }
    await new Promise((r) => setTimeout(r, 500));
    for (const dir of tmpDirs) {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  };
}
