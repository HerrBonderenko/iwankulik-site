// Конфіг тестів. Два шари в одному прогоні:
//   tests/unit        — чисті функції, без сервера, миттєві;
//   tests/integration — справжні HTTP-запити до зібраного застосунку,
//                       який піднімає tests/setup/global.mjs.
// Критерій корисності кожного тесту один: він мусить упасти, якщо
// відповідний захист прибрати (див. SECURITY_AUDIT_REPORT.md, §6).
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" кидає виняток поза React Server Components —
      // у тестах підміняємо порожнім модулем, щоб імпортувати lib/*.
      "server-only": path.resolve("./tests/stubs/server-only.js"),
      "@": path.resolve("."),
    },
  },
  test: {
    globalSetup: "./tests/setup/global.mjs",
    // Інтеграційні тести ділять стан сервера (лічильники лімітів,
    // журнал) — файли йдуть послідовно, щоб не заважати одне одному.
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 600_000, // globalSetup може збирати проєкт з нуля
  },
});
