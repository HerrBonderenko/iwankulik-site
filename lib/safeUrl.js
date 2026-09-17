// Єдина перевірка адрес, які приходять із тіла запиту або з даних
// адмінки й потім потрапляють у href листа чи в серверне читання.
//
// new URL() сам по собі перевіркою не є: base він використовує лише для
// відносних шляхів, а абсолютні пропускає з будь-якою схемою —
// javascript:, data:, vbscript: повертаються як є. Тому окремо
// перевіряємо і схему, і хост (SECURITY_AUDIT_REPORT.md, F-05/F-06).
import { SITE_URL } from "@/lib/seo";

const SITE_HOST = new URL(SITE_URL).host;

// Vercel Blob віддає завантажені фото зі свого домену — єдине чуже
// походження, яке вважаємо своїм (те саме, що в img-src CSP і в
// remotePatterns next.config.mjs).
const VERCEL_BLOB_HOST_RE = /\.public\.blob\.vercel-storage\.com$/;

export function isAllowedImageHost(host) {
  return host === SITE_HOST || VERCEL_BLOB_HOST_RE.test(host);
}

// Абсолютний http(s)-URL на своєму домені чи в сховищі Vercel Blob;
// відносні шляхи добудовуються від SITE_URL. null на будь-що інше —
// зокрема на javascript:, data: і чужі домени: значення йде в href
// листа власникові, і підмінена адреса там виглядала б як своя.
export function safeAbsoluteUrl(path) {
  if (!path) return null;
  try {
    const url = new URL(path, SITE_URL);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!isAllowedImageHost(url.host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
