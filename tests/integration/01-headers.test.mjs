// Заголовки безпеки на живих відповідях. Падає, якщо headers() у
// next.config.mjs зламають або CSP стане Report-Only на проді.
import { describe, it, expect } from "vitest";
import { BASE } from "./helpers.mjs";

describe("заголовки безпеки", () => {
  it("сторінка сайту віддає повний набір", async () => {
    const res = await fetch(`${BASE}/uk`);
    expect(res.status).toBe(200);
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("CSP увімкнена (не Report-Only) і тримає ключові директиви", async () => {
    const res = await fetch(`${BASE}/uk`);
    const csp = res.headers.get("content-security-policy");
    expect(csp, "заголовок мусить бути enforced, а не -Report-Only").toBeTruthy();
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"]) {
      expect(csp).toContain(directive);
    }
    // Відома й задокументована межа політики: 'unsafe-inline' лишається
    // вимушено (RSC-інлайни), тож інʼєкцію onerror вона НЕ зупинить —
    // доведено в браузері (SECURITY_AUDIT_REPORT.md, R-03). Якщо цей
    // рядок колись упаде через зникнення 'unsafe-inline' — це добра
    // новина: перевірте гідратацію і приберіть і тест, і примітку.
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("адмінка теж під заголовками", async () => {
    const res = await fetch(`${BASE}/admin`);
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
