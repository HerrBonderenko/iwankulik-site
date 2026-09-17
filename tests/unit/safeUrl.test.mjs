// lib/safeUrl.js — єдина перевірка адрес, що йдуть у href листа та в
// серверні читання. Тести падають, якщо прибрати перевірку схеми або
// хоста (аудит, F-05/F-06).
import { describe, it, expect } from "vitest";
import { safeAbsoluteUrl, isAllowedImageHost } from "@/lib/safeUrl";

describe("safeAbsoluteUrl", () => {
  it("відкидає небезпечні схеми", () => {
    expect(safeAbsoluteUrl("javascript:alert(1)")).toBeNull();
    expect(safeAbsoluteUrl("data:text/html,<b>audit-marker</b>")).toBeNull();
    expect(safeAbsoluteUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeAbsoluteUrl("blob:https://x/y")).toBeNull();
  });

  it("відкидає чужі домени, зокрема protocol-relative", () => {
    expect(safeAbsoluteUrl("https://evil.example/pay")).toBeNull();
    expect(safeAbsoluteUrl("//evil.example/pay")).toBeNull();
    // Хост, що лише закінчується схоже на дозволений
    expect(safeAbsoluteUrl("https://x.public.blob.vercel-storage.com.evil.io/a")).toBeNull();
  });

  it("пропускає свій домен і сховище Vercel Blob", () => {
    expect(safeAbsoluteUrl("/uk/zhyvopys#id")).toMatch(/^https?:\/\/.+\/uk\/zhyvopys#id$/);
    expect(safeAbsoluteUrl("https://abc.public.blob.vercel-storage.com/u/x.webp")).toBe(
      "https://abc.public.blob.vercel-storage.com/u/x.webp"
    );
  });

  it("порожнє й сміття — null", () => {
    expect(safeAbsoluteUrl("")).toBeNull();
    expect(safeAbsoluteUrl(null)).toBeNull();
    expect(safeAbsoluteUrl(undefined)).toBeNull();
  });
});

describe("isAllowedImageHost", () => {
  it("чужий хост — false (SSRF-захист OG-генератора)", () => {
    expect(isAllowedImageHost("127.0.0.1:9999")).toBe(false);
    expect(isAllowedImageHost("metadata.internal")).toBe(false);
    expect(isAllowedImageHost("evil.public.blob.vercel-storage.com.evil.io")).toBe(false);
  });
  it("сховище Vercel Blob — true", () => {
    expect(isAllowedImageHost("abc.public.blob.vercel-storage.com")).toBe(true);
  });
});
