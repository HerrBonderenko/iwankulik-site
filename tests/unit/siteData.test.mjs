// lib/siteData.mjs: валідація даних сайту, яку ділять адмінка і
// scripts/push-data.mjs. Тест на contacts.instagram падає, якщо прибрати
// перевірку схеми (аудит, R-04).
import { describe, it, expect } from "vitest";
import { validateSiteData } from "@/lib/siteData.mjs";

function validData(overrides = {}) {
  return {
    paintings: [],
    cycles: [],
    authenticityPhotos: {},
    hero: { videoEnabled: false, video: "" },
    processSection: { videoEnabled: false, video: "" },
    contacts: { email: "a@example.invalid", phone: "", instagram: "" },
    ...overrides,
  };
}

describe("validateSiteData", () => {
  it("еталонні дані проходять", () => {
    expect(validateSiteData(validData())).toBeNull();
  });

  it("contacts.instagram: небезпечні схеми відкидаються з назвою перевірки", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "не-url"]) {
      const data = validData();
      data.contacts.instagram = bad;
      expect(validateSiteData(data), bad).toBe("contacts.instagram");
    }
  });

  it("contacts.instagram: http(s) і порожнє значення проходять", () => {
    for (const ok of ["", "https://instagram.com/iwankulik", "http://instagram.com/x"]) {
      const data = validData();
      data.contacts.instagram = ok;
      expect(validateSiteData(data), ok).toBeNull();
    }
  });

  it("зламана структура називає поле", () => {
    expect(validateSiteData(null)).toBe("тіло запиту");
    expect(validateSiteData(validData({ paintings: "not-array" }))).toBe("paintings");
    expect(validateSiteData(validData({ hero: { videoEnabled: "true", video: "" } }))).toBe("hero");
  });
});
