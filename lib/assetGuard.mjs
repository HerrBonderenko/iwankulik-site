// Сторож кешу картинок. /assets/* віддається як immutable на рік
// (netlify.toml [[headers]], vercel.json): так Netlify Image CDN тримає
// перетворені картинки в кеші, а не стискає героя заново на кожен показ.
// Ціна — файл не можна міняти під тим самим ім'ям: браузер, що вже бачив
// сайт, рік показуватиме стару версію. Тож збірка падає, щойно git бачить
// таку заміну, — і каже, що робити.
//
// Звичайний Node без аліасів і без імпортів із lib/*.js: викликається з
// next.config.mjs (лише у фазі production-збірки), а версію Node ніде не
// закріплено.
import { execFileSync } from "node:child_process";

const DIR = "public/assets";

function git(cwd, args) {
  return execFileSync("git", ["-c", "core.quotepath=off", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * Файли public/assets, вміст яких змінювався під тим самим ім'ям:
 * у закомічених змінах (M, або повторне додавання після видалення) і в
 * незакоміченій робочій копії. Перейменування не рахується: з --no-renames
 * воно видно як видалення старого шляху й додавання нового.
 * @returns {{ skipped?: string, replaced: {path: string, why: string}[] }}
 */
function findReplacedAssets(cwd = process.cwd()) {
  try {
    // Неглибокий клон бачить лише верхній коміт — історії, з якою
    // порівнювати, у ньому нема.
    if (git(cwd, ["rev-parse", "--is-shallow-repository"]).trim() !== "false") {
      return { skipped: "неглибокий клон git — історії для порівняння нема", replaced: [] };
    }
  } catch {
    return { skipped: "git недоступний", replaced: [] };
  }

  const current = new Set(git(cwd, ["ls-files", DIR]).split("\n").filter(Boolean));
  const changes = new Map(); // шлях → [{ status, commit }]
  let commit = "";
  const log = git(cwd, ["log", "--format=%x00%h %cs %s", "--name-status", "--no-renames", "--", DIR]);
  for (const line of log.split("\n")) {
    if (line.startsWith("\0")) {
      commit = line.slice(1);
    } else if (/^[AM]\t/.test(line)) {
      const [status, path] = line.split("\t");
      if (!changes.has(path)) changes.set(path, []);
      changes.get(path).push({ status, commit });
    }
  }

  const replaced = [];
  for (const [path, list] of changes) {
    if (!current.has(path)) continue;
    const modified = list.find((c) => c.status === "M");
    const added = list.filter((c) => c.status === "A");
    if (modified) replaced.push({ path, why: `змінено в коміті ${modified.commit}` });
    else if (added.length > 1) replaced.push({ path, why: `додано вдруге під тим самим ім'ям у коміті ${added[0].commit}` });
  }

  // Ще не закомічена заміна — щоб локальна збірка зупинила її до коміту.
  for (const line of git(cwd, ["status", "--porcelain", "--", DIR]).split("\n")) {
    const m = /^ ?M ?\s+(.+)$/.exec(line);
    if (m && current.has(m[1]) && !replaced.some((r) => r.path === m[1])) {
      replaced.push({ path: m[1], why: "змінено в робочій копії (ще не закомічено)" });
    }
  }
  return { replaced };
}

export function assertAssetsNotReplaced(cwd = process.cwd()) {
  const { skipped, replaced } = findReplacedAssets(cwd);
  if (skipped) {
    console.warn(`[assets] перевірку заміни картинок пропущено: ${skipped}`);
    return;
  }
  if (!replaced.length) return;
  throw new Error(
    [
      "Картинку в public/assets замінено під тим самим ім'ям.",
      "/assets/* віддається як immutable на рік (netlify.toml, vercel.json), тож відвідувачі, які вже бачили сайт, ще рік бачитимуть стару версію.",
      "",
      ...replaced.map((r) => `  • ${r.path} — ${r.why}`),
      "",
      "Що робити: поверни старий файл, а новий поклади під новим ім'ям (напр. iwan-kulik-2026.webp) і онови посилання на нього.",
      "Фото героя, «Про мене», циклів, картин, автентичності й обкладинки статей міняй через адмінку: там кожне завантаження отримує нове ім'я, і кеш не заважає.",
    ].join("\n")
  );
}
