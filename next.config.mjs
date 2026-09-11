// Content-Security-Policy.
//
// script-src 'unsafe-inline' — вимушено, і ось чому. App Router вкладає
// payload React Server Components прямо в HTML інлайновими скриптами
// (self.__next_f.push(...)): на дев'яти сторінках сайту їх 47, вміст у
// кожної свій і змінюється з кожною збіркою. Захешувати їх неможливо, а
// nonce вимагає, щоб HTML генерувався на кожен запит — тобто відмови від
// статики для всіх 106 сторінок. Наш власний інлайн (theme-init) захешувати
// якраз можна, але хеш і 'unsafe-inline' в одній директиві несумісні:
// щойно з'являється хеш, браузер ігнорує 'unsafe-inline' — і всі 47
// скриптів Next.js падають разом із гідратацією.
//
// Що політика все одно тримає: зовнішній скрипт (<script src=чужий-домен>)
// не завантажиться — виняток лише cloud.umami.is; дані нікуди не підуть —
// connect-src замкнений на свій домен і шлюз Umami, img-src — на свій
// домен і сховище нижче; <base> не підмінити, форму не перенаправити на
// чужий приймач, сайт не вкласти в чужий фрейм.
//
// Umami Cloud (аналітика, див. (site)/[locale]/layout.js): сам скрипт
// береться з cloud.umami.is, а події він шле POST-запитом на інший домен —
// gateway.umami.is/api/send (адреса за замовчуванням у script.js,
// перевірено по його коду). Без gateway.umami.is у connect-src скрипт
// завантажився б, а кожна подія мовчки падала б на CSP.
//
// blob: в img-src — прев'ю фото в адмінці: PhotoField робить
// URL.createObjectURL(file) ще до завантаження на сервер.
// data: — заглушки й службові однопіксельні зображення.
// *.public.blob.vercel-storage.com — сховище Vercel Blob віддає файли зі
// свого домену. Netlify Blobs сюди не треба: їх ми віддаємо своїм
// маршрутом /uploads/[file], тобто зі свого домену.
// 'unsafe-eval' не потрібен: у клієнтських чанках прод-збірки немає ні
// eval(, ні new Function( — перевірено пошуком по .next/static.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self' https://gateway.umami.is",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
    // Типово Next має ще 2048 і 3840. Прибрано як мертві кандидати:
    // Next не збільшує зображення понад оригінал, а джерела в /assets
    // вужчі за 2048 (герой — 1200x1680), тож w=1920, 2048 і 3840
    // віддавали байт у байт той самий файл. Виміряно на проді: усі
    // чотири варіанти по 355 КБ. Тобто економія тут нульова, зникають
    // лише дублі в srcset.
    //
    // Стеля 1920 має значення на майбутнє: завантаження з адмінки
    // ужимаються до 2500x2500 (app/api/admin/upload), і якщо колись
    // покласти ширшого героя, Retina-екран отримає 1920 замість 2048.
    // Якщо різкість героя на великих екранах стане важливою — цей рядок
    // прибрати першим.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // З Next 16 дозволені якості треба перелічити явно (типово лише [75]),
    // інакше <Image quality={60}> впаде на збірці. 60 — для героя головної:
    // на вимірі проду це 172 КБ замість 197 КБ при q=75, а різниці на око
    // в живописі під затемненням градієнта немає.
    qualities: [60, 75],
    // Скільки браузер тримає вже оптимізовану картинку. На Netlify TTL
    // диктує Cache-Control джерела (див. [[headers]] у netlify.toml),
    // тут значення працює на Vercel-збірці.
    minimumCacheTTL: 31536000,
  },
  // sharp має нативний бінарник — sharp уже в стандартному переліку Next.js,
  // але фіксуємо явно, щоб бандлер точно не спробував затягнути його в
  // серверний JS-бандл (це ламає нативні .node-файли).
  serverExternalPackages: ["sharp"],
  // Netlify виставляє NETLIFY=true лише на етапі build; у рантаймі
  // Server Handler (Netlify Function) цієї змінної вже немає.
  // Фіксуємо ознаку хмари саме тут — Next.js вбудовує значення як
  // літерал у скомпільований код, тож рантайм-оточення більше не важливе.
  env: {
    IS_NETLIFY_BUILD: process.env.NETLIFY ?? "",
    // Ознака продакшн-деплою для аналітики. NODE_ENV тут не годиться:
    // у deploy preview і branch deploy Netlify він теж "production".
    // Відрізняє їх лише CONTEXT ("production" | "deploy-preview" |
    // "branch-deploy" | "dev"), а він, як і NETLIFY, є тільки на збірці —
    // тому вшиваємо так само. VERCEL_ENV — те саме для Vercel-збірки.
    // Локально обидві змінні порожні, тож і `next build` на своїй машині
    // скрипт аналітики не отримує.
    IS_PRODUCTION_DEPLOY:
      process.env.CONTEXT === "production" || process.env.VERCEL_ENV === "production" ? "1" : "",
  },
  // Сторінки йдуть через Next.js Server Handler (Netlify Function), а не
  // як статика — тож заголовки безпеки з netlify.toml [[headers]] їх не
  // зачіпають. Виставляємо їх тут, самим Next.js, для всіх відповідей.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            // Увімкнена, не Report-Only. У dev лишається Report-Only:
            // Turbopack віддає модулі через eval і додає свої інлайни, і
            // під бойовою політикою dev-сервер просто не працював би —
            // а послаблювати політику заради dev означало б випустити на
            // прод не те, що перевіряли.
            key: isProd
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: csp,
          },
        ],
      },
    ];
  },
};
// Функція фази замість об'єкта — лише заради сторожа картинок: у фазі
// production-збірки він валить збірку, якщо файл у public/assets замінено
// під тим самим ім'ям (див. lib/assetGuard.mjs). У dev і start не працює.
// "phase-production-build" — значення PHASE_PRODUCTION_BUILD з next/constants.
export default async function config(phase) {
  if (phase === "phase-production-build") {
    const { assertAssetsNotReplaced } = await import("./lib/assetGuard.mjs");
    assertAssetsNotReplaced();
  }
  return nextConfig;
}
