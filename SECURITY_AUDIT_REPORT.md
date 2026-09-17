# Аудит безопасности iwankulik-site

Дата: 2026-09-16. Ветка: `claude/magical-tesla-ojsk6y`, HEAD `ed320fc`.
Метод: статический анализ кода и конфигурации репозитория. Запросов к
продакшену, внешним сервисам и чужим хостам не делалось. **Код не менялся** —
в репозиторий добавлен только этот файл.

---

## 7.1. Резюме

### Стек

| Что | Значение | Где видно |
|---|---|---|
| Фреймворк | Next.js 16.3.2, App Router, plain JS (без TypeScript) | `package.json:17`, `app/` |
| База данных | **Отсутствует** | — |
| ORM / драйвер | Отсутствует | — |
| Хранилище | Netlify Blobs / Vercel Blob / локальная ФС — драйвер выбирается в рантайме | `lib/store.js:20` |
| Аутентификация | `iron-session` (зашифрованная cookie) + bcrypt, один админ-аккаунт из `ADMIN_USERS` | `lib/adminAuth.js` |
| Хостинг | Двойной таргет: Netlify (основной) и Vercel (запасной) | `netlify.toml`, `vercel.json` |
| Почта | Resend | `lib/mail.js` |
| Внешние сервисы | Umami Cloud (аналитика, только прод-деплой) | `app/(site)/[locale]/layout.js:131-138` |
| Контент блога | MDX-файлы из git (`blog-content/`), рендер `next-mdx-remote` | `lib/blog.js:17,241-268` |
| Роутинг локалей | `proxy.js` (в Next 16 это бывший `middleware.js`) | `proxy.js` |

### Карта точек ввода (sources)

| Точка | Метод | Аутентификация | Что принимает |
|---|---|---|---|
| `/api/inquiry` | POST | **нет** | JSON заявки: `name`, `email`, `phone`, `comment`, `subject`, `orderType`, honeypot `website`, токен формы |
| `/api/inquiry/painting` | POST | **нет** | то же + `workId`, `paintingTitle`, `paintingImg`, `pageUrl` |
| `/api/form-token` | GET | **нет** | — (выдаёт подписанный одноразовый токен) |
| `/api/admin/login` | POST | **нет** (это и есть вход) | JSON `{login, password}` |
| `/api/admin/logout` | POST | сессия | — |
| `/api/admin/data` | GET / PUT | сессия | весь контент сайта (JSON) |
| `/api/admin/blog-posts` | GET | сессия | — |
| `/api/admin/upload` | POST | сессия | multipart-файл |
| `/uploads/[file]` | GET | **нет** | имя файла из пути |
| `/[locale]/blog/[slug]` | GET | **нет** | path-параметры `locale`, `slug` |
| `/[locale]/cycles/[slug]` | GET | **нет** | path-параметры |
| `/[locale]/zhyvopys?w=` | GET | **нет** | query-параметр `w` (id работы) |
| `/admin/logs?month=&action=` | GET | сессия | query-параметры (оба через whitelist) |
| Заголовки | — | — | `x-nf-client-connection-ip`, `x-forwarded-for`, `x-real-ip`, `user-agent`, `content-length`, `accept-language`, cookie `locale` |
| Webhooks | — | — | **отсутствуют** |

### Карта мест вывода (sinks)

| Куда | Что туда попадает | Экранирование |
|---|---|---|
| Публичные страницы | контент из хранилища (тексты, названия работ, цены) | React (автоэкранирование) |
| Админка `/admin` | то же + журнал событий | React |
| Журнал `/admin/logs` | `detail`, `user`, `ip` из записей лога | React |
| **HTML-письмо заявки** | имя, телефон, email, комментарий, тема, IP посетителя | `escapeHtml` (`lib/mail.js:58-65`) |
| **HTML-письмо о новом устройстве / блокировке** | логин, IP, User-Agent | `escapeHtml` |
| Заголовок `Reply-To` | email из формы | `sanitizeReplyTo` (`lib/mail.js:15-21`) |
| Тема письма | `data.subject` / название работы | **не экранируется и не ограничивается** (F-03) |
| JSON-LD | названия работ, циклов, статей | `JSON.stringify` + экранирование `<` (`components/JsonLd.js:4`) |
| `<title>`, OG, meta | словари + frontmatter статей | Next (автоэкранирование) |
| OG-картинки (PNG→JPEG) | заголовки, фон по пути из админки | Satori/sharp, не HTML |
| `sitemap.xml`, `image-sitemap.xml` | заголовки и описания статей из git | `escapeXml` (`app/image-sitemap.xml/route.js:8-13`) |
| Аудит-лог (блоб) | имя, email, телефон заявителя; логин попытки входа; IP; UA | **не ограничивается** (F-04) |
| `console.log` функции | имя, email, телефон, длина комментария | — |
| Экспорт CSV/Excel, PDF, мессенджеры | **отсутствуют** | — |

### Хранилища

Единый драйвер `lib/store.js` (Netlify Blobs → Vercel Blob → ФС `content/`), тот же
механизм переиспользуют `lib/auditLog.js`, `lib/rateLimit.js`, `lib/deviceTracking.js`,
`lib/formGuard.js` (использованные nonce).

| Ключ | Что лежит | Кто пишет | Кто читает |
|---|---|---|---|
| `data/site-data.json` | весь контент сайта | админка (PUT) | все публичные страницы |
| `uploads/*` | загруженные фото (всегда WebP) | админка | `/uploads/[file]`, `next/image` |
| `logs/YYYY-MM` | журнал событий | все роуты | `/admin/logs` |
| `ratelimit/login/<ip>`, `ratelimit/inquiry/<ip>` | счётчики | логин, формы | они же |
| `formnonce/<nonce>` | погашенные токены форм | `guardInquiry` | он же |
| `known-devices/<login>` | SHA-256 отпечатки (подсеть/24 + UA) | логин | логин |

### Роли и доступы

Ролей две: **гость** и **админ**. Регистрации, пользовательских аккаунтов,
владения объектами нет — значит, нет и классического IDOR. Всё под `/api/admin/*`
проверяет сессию в самом обработчике (`isAuthed()` / `session.login`), а не только
в UI; `/admin` и `/admin/logs` — серверная проверка в page-компоненте.

### Находки по уровням

| Уровень | Количество |
|---|---|
| Критический (20–25) | 0 |
| Высокий (12–19) | 2 |
| Средний (6–11) | 5 |
| Низкий (1–5) | 3 |

**Главный вывод.** Сценарий из раздела 2 ТЗ (бот через 16 секунд бьёт по форме
SQL-инъекцией и перебором XSS) на этом сайте не срабатывает ни в одной точке:
базы данных нет вообще, а весь пользовательский ввод, попадающий в HTML —
и на страницах, и в письмах, — экранируется. Проблемы, которые нашлись, —
не про «кавычку в поле имени», а про устаревшую зависимость, про поля, которые
валидация пропустила, и про доверие к заголовкам.

### Топ-5, что закрыть первым

1. **F-01** — `next@16.3.2` с двумя критическими CVE (в т.ч. неаутентифицированный RCE в Image Optimization API). Одна команда: `npm i next@^16.3.5 sharp@^0.35.4`.
2. **F-02** — на Vercel заголовок `x-nf-client-connection-ip` подделывается клиентом, и защита от перебора пароля админки снимается целиком.
3. **F-03** — `subject`, `pageUrl`, `paintingImg`, `workId` не проходят валидацию длины: неограниченная строка едет в тему письма и в журнал.
4. **F-04** — журнал принимает неограниченный `login` из публичного `/api/admin/login` и хранит ПД заявителей без срока.
5. **F-05** — ссылка в письме о заявке строится из тела запроса без проверки схемы: в письмо владельцу можно положить `javascript:`/`data:`/чужой домен.

---

## 7.2. Сводная таблица

| ID | Категория | Где (файл:строка) | Защита | Вер. | Влияние | Риск | Уровень |
|---|---|---|---|---|---|---|---|
| F-01 | Уязвимые зависимости / RCE | `package.json:17`, `package.json:26` | Нет | 3 | 5 | 15 | **Высокий** |
| F-02 | Обход rate limiting (подделка IP) | `lib/rateLimit.js:92-103` | Частичная | 3 | 4 | 12 | **Высокий** |
| F-03 | Неполная валидация ввода | `lib/formGuard.js:18`, `app/api/inquiry/painting/route.js:140` | Частичная | 4 | 2 | 8 | Средний |
| F-04 | Логирование: раздувание + ПД | `lib/auditLog.js:78-88`, `app/api/admin/login/route.js:56` | Частичная | 4 | 2 | 8 | Средний |
| F-05 | Инъекция URL в HTML-письмо | `app/api/inquiry/painting/route.js:11-18,81-82,105,120` | Частичная | 3 | 3 | 9 | Средний |
| F-06 | SSRF / чтение файлов из данных админки | `lib/ogImage.js:29-41` | Нет | 2 | 3 | 6 | Средний |
| F-07 | Нет предпроверки размера тела | `app/api/admin/login/route.js:37`, `app/api/admin/upload/route.js:43` | Нет | 3 | 2 | 6 | Средний |
| F-08 | CSP не гасит инъекцию обработчиков | `next.config.mjs:35` | Частичная | 1 | 4 | 4 | Низкий |
| F-09 | Path traversal в чтении статей | `lib/blog.js:25-27,84-90` | Частичная | 2 | 2 | 4 | Низкий |
| F-10 | CSRF: нет проверки Origin | `lib/adminAuth.js:13-18` | Частичная | 1 | 3 | 3 | Низкий |

---

## 7.3. Детали по каждой находке

### [F-01] Критические CVE в next 16.3.2 и sharp 0.35.3

- **Категория:** уязвимые зависимости / удалённое выполнение кода
- **Расположение:** `package.json:17` (`"next": "^16.3.2"`), `package.json:26` (`"sharp": "^0.35.3"`), `package-lock.json:6466`
- **Уязвимый код:**

```json
"next": "^16.3.2",
"sharp": "^0.35.3"
```

`npm audit` на текущем lock-файле:

```
next  16.0.0 - 16.3.2   Severity: critical
  Unauthenticated Remote Code Execution on windows-hosted servers   GHSA-p293-qw3h-jr36
  Unauthenticated RCE in Image Optimization API when AVIF files are used   GHSA-2xp9-vwfh-vxw4
sharp  <0.35.4          Severity: high
  Vulnerabilities in libheif   GHSA-rgj7-g3m4-5g8c
js-yaml  4.0.0 - 4.3.1  Severity: high   (транзитивно через gray-matter)
  maxTotalMergeKeys does not limit CPU use   GHSA-2883-xcg3-v3hh
3 vulnerabilities (2 high, 1 critical)
```

- **Поток данных:** внешний — запрос к `/_next/image` (эндпоинт публичный, без авторизации).
- **Сценарий атаки:** сканер определяет версию Next по характерным путям `/_next/static/…` и бьёт по публичному эндпоинту оптимизации изображений известным для этой версии способом. Аутентификация не нужна.
- **Существующая защита:** нет. Диапазон `^16.3.2` **позволяет** установить исправленную 16.3.3+, но `package-lock.json` фиксирует именно 16.3.2, а Netlify собирает через `npm ci` — то есть на прод уезжает уязвимая версия.
- **Оценка:** Вероятность 3 / Влияние 5 / Риск **15**.
  Влияние 5 — RCE на сервере. Вероятность 3, а не 5, потому что реальная достижимость уязвимого кода зависит от площадки: и Netlify, и Vercel обслуживают оптимизацию картинок собственным Image CDN, а не кодом Next внутри функции. Проверить это по репозиторию нельзя — см. «Не проверено». Windows-CVE не применим: обе площадки на Linux. `sharp` не достижим через HEIF: загрузка отсеивает всё, кроме JPEG/PNG/WebP, по magic bytes (`app/api/admin/upload/route.js:16-35`) ещё до вызова sharp. `js-yaml` парсит только frontmatter статей из git.
- **Исправление:**

```bash
npm i next@^16.3.5 sharp@^0.35.4
npm audit fix          # подтянет js-yaml через gray-matter
npm run lint && npm run build
git add package.json package-lock.json
```

- **Как проверить:** `npm audit` должен дать `found 0 vulnerabilities`; `npm run build` — пройти с тем же числом страниц, что и до обновления (счётчик в конце вывода сборки).

---

### [F-02] IP для rate limiting берётся из заголовка, который вне Netlify подделывает клиент

- **Категория:** обход защиты от перебора / подделка источника запроса
- **Расположение:** `lib/rateLimit.js:92-103`
- **Уязвимый код:**

```js
export function getClientIp(request) {
  const nf = request.headers.get("x-nf-client-connection-ip");
  if (nf) return nf;
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return process.env.NODE_ENV === "production" ? null : "local";
}
```

- **Поток данных:** заголовок запроса → `getClientIp()` → ключ счётчика `ratelimit/login/<ip>` (`lib/rateLimit.js:19-21`) и `ratelimit/inquiry/<ip>` (`lib/formGuard.js:102`) → решение «блокировать или нет».
- **Сценарий атаки:** атакующий отправляет каждый запрос со своим значением `x-nf-client-connection-ip` (или, если платформа его не ставит, со своим первым элементом в `x-forwarded-for`). Каждый запрос получает собственный счётчик, ни один не доходит до порога. Тем самым снимаются сразу три ограничения: 5 попыток до блокировки логина (`MAX_ATTEMPTS`), 6 заявок в час с адреса (`INQUIRY_LIMIT`) и письмо-уведомление о начавшемся переборе (`app/api/admin/login/route.js:61-62`, оно шлётся только в момент срабатывания блокировки, которая теперь не наступает). В журнале при этом останутся тысячи `login_fail` с разными выдуманными IP.
- **Существующая защита:** частичная. На Netlify `x-nf-client-connection-ip` ставит сама платформа, и до ветки `x-forwarded-for` выполнение не доходит — там находка не применима. На Vercel (второй целевой деплой, `vercel.json` в репозитории) этот заголовок не ставит никто: он придёт ровно таким, каким его прислал клиент, и будет принят первым же условием. Правильная для Vercel ветка `x-forwarded-for` тоже небезопасна сама по себе: прокси дописывает реальный адрес в конец цепочки, а код берёт первый элемент, то есть присланный клиентом.
- **Оценка:** Вероятность 3 / Влияние 4 / Риск **12**.
  Вероятность 3: подстановка `X-Forwarded-For` — типовая проверка сканеров, но выигрыш есть только на Vercel-деплое. Влияние 4: bcrypt cost 12 и задержка 1 с на неудачу оставляют перебор дорогим, но единственный настоящий барьер — блокировка по IP — исчезает.
- **Исправление:** источник адреса должен быть один и выбираться по площадке, а не по принципу «какой заголовок первым нашёлся».

```js
// lib/rateLimit.js
// Один доверенный источник на площадку. Заголовок, который на этой
// площадке не ставит прокси, принимать нельзя: его пришлёт клиент.
const TRUSTED_IP_HEADER =
  process.env.IS_NETLIFY_BUILD ? "x-nf-client-connection-ip" :
  process.env.VERCEL ? "x-vercel-forwarded-for" :
  null;

export function getClientIp(request) {
  if (process.env.NODE_ENV !== "production") return "local";
  if (!TRUSTED_IP_HEADER) return null;       // неизвестная площадка — лимит по IP невозможен
  const value = request.headers.get(TRUSTED_IP_HEADER);
  return value ? value.split(",")[0].trim() : null;
}
```

- **Как проверить:** два запроса на `/api/admin/login` с заведомо неверным паролем — один без лишних заголовков, второй с `x-nf-client-connection-ip: 203.0.113.7`. В журнале `/admin/logs` обе записи `login_fail` должны показывать **один и тот же** IP. До исправления — два разных.

---

### [F-03] Часть полей заявки не проходит валидацию длины и уезжает в тему письма

- **Категория:** неполная валидация ввода
- **Расположение:** `lib/formGuard.js:18` (список лимитов), `app/api/inquiry/painting/route.js:80,84,140,162`, `app/api/inquiry/route.js:47`
- **Уязвимый код:**

```js
// lib/formGuard.js:18 — поля subject, paintingTitle, paintingImg, pageUrl,
// workId, orderType в этом списке отсутствуют
const LENGTH_LIMITS = { name: 100, email: 200, phone: 50, comment: 2000, city: 100, area: 100, size: 100, plot: 500 };
```

```js
// app/api/inquiry/painting/route.js:80,84,140
const title = work?.title || data.paintingTitle || data.subject || "робота";
const heading = work?.code ? `${work.code} «${title}»` : `«${title}»`;
...
subject: `Заявка: ${heading}`,
```

- **Поток данных:** тело POST `/api/inquiry/painting` → `data.subject` (клиент сайта его тоже шлёт — `components/OrderForm.js:28`, так что имя поля известно всем) → при ненайденном `workId` попадает в `title` → в **тему письма** и в `detail` аудит-лога (`:162`), который живёт в блобе бессрочно.
- **Сценарий атаки:** бот шлёт заявку, где `subject` — строка на несколько десятков килобайт (в лимит тела 64 КБ помещается). Письмо приходит с нечитаемой темой, в журнале оседает такая же запись. Повторяя это шесть раз в час с адреса (и неограниченно, если получилось обойти лимит по F-02), можно надуть месячный блоб журнала до сотен мегабайт — а `logEvent` на каждое событие читает и переписывает его целиком (`lib/auditLog.js:64,89`).
- **Существующая защита:** частичная. `checkBodySize` (`lib/formGuard.js:33-39`) ограничивает тело 64 КБ — это единственный барьер. Экранирование при выводе в HTML-тело письма работает (`escapeHtml`), то есть XSS здесь нет; речь именно о длине и о том, что тема письма — не HTML и через `escapeHtml` не проходит.
- **Оценка:** Вероятность 4 / Влияние 2 / Риск **8**.
  Вероятность 4: точка публичная, поле штатное, перебор граничных значений длины — типовое поведение сканера. Влияние 2: деградация журнала и почты, не компрометация.
- **Исправление:** добавить поля в общий список лимитов и отдельно почистить тему письма от управляющих символов (страховка от инъекции заголовка, если транспорт когда-то сменится с JSON-API Resend на SMTP):

```js
// lib/formGuard.js:18
const LENGTH_LIMITS = {
  name: 100, email: 200, phone: 50, comment: 2000,
  city: 100, area: 100, size: 100, plot: 500,
  // Поля, которые едут в тему письма и в журнал: без лимита они
  // ограничены только размером тела запроса.
  subject: 200, paintingTitle: 200, paintingImg: 500, pageUrl: 500,
  workId: 100, orderType: 50,
};
```

```js
// lib/mail.js — рядом с sanitizeReplyTo
// Тема письма не проходит через escapeHtml (это не HTML), поэтому
// управляющие символы и перенос строки убираем здесь, в единственной
// точке отправки.
function sanitizeSubject(value) {
  return String(value ?? "").replace(/[ -]/g, " ").trim().slice(0, 200);
}
// и в resend.emails.send: subject: sanitizeSubject(subject)
```

- **Как проверить:** POST на `/api/inquiry/painting` с `subject` из 5000 символов должен вернуть `400 {"ok":false,"error":"too_long"}`, а не 200. Отдельно: `sanitizeSubject("тема\r\nBcc: audit-marker@example.com")` возвращает строку без переносов.

---

### [F-04] Журнал принимает неограниченные значения из публичных запросов и бессрочно хранит ПД

- **Категория:** логирование / раздувание хранилища / хранение персональных данных
- **Расположение:** `lib/auditLog.js:78-88`, `app/api/admin/login/route.js:56`, `app/api/inquiry/route.js:104`, `lib/formGuard.js:134,144,150`
- **Уязвимый код:**

```js
// lib/auditLog.js:78-88 — обрезается только ua
list.push({
  ts: now.toISOString(),
  action,
  user: user || null,
  ua: ua ? String(ua).slice(0, 256) : null,
  detail: detail || null,        // <- длина не ограничена
});
```

```js
// app/api/admin/login/route.js:37,56 — login приходит из тела и никак не проверяется
const { login, password } = await request.json().catch(() => ({}));
...
detail: `спроба входу як "${login || ""}"`,
```

```js
// app/api/inquiry/route.js:104 — имя, телефон и email заявителя в журнал
detail: `заявка від ${data.name}${contacts ? ` (${contacts})` : ""}`,
```

- **Поток данных:** (а) тело POST `/api/admin/login` → `login` → `detail` → блоб `logs/YYYY-MM`; (б) поля заявки → `detail`/`user` → тот же блоб; (в) `guardInquiry` пишет `user: data.email` **до** проверки длины (порядок в `lib/formGuard.js:131-160`: спам → nonce → лимит → валидация), поэтому в журнал попадает неограниченный email.
- **Сценарий атаки:** пять запросов на `/api/admin/login` с полем `login` по 60 КБ — ровно столько разрешает лимит до блокировки IP, и каждый успевает записаться. Блокировка снимается через 15 минут, цикл повторяется; сменив IP (что тривиально при F-02), цикл повторяется сразу. Лимит в 5000 записей за месяц (`MAX_ENTRIES_PER_MONTH`) считает записи, а не байты. Побочный эффект: каждое последующее событие читает и переписывает разбухший блоб целиком, а страница `/admin/logs` пытается его отрисовать.
- **Существующая защита:** частичная — `ua` обрезан до 256 символов, число записей за месяц ограничено, битый файл журнала карантинится. Ни длина `detail`/`user`, ни размер тела запроса на логине не ограничены.
- **Оценка:** Вероятность 4 / Влияние 2 / Риск **8**.
- **Исправление:** обрезать на входе в журнал — это единственная точка, через которую проходят все события:

```js
// lib/auditLog.js
// Значения приходят и из публичных запросов, поэтому режем здесь, в
// единственной точке записи, а не в каждом вызывающем роуте.
const cap = (v, n) => (v == null ? null : String(v).slice(0, n));

list.push({
  ts: now.toISOString(),
  action,
  user: cap(user, 200),
  ip: cap(ip, 64),
  ua: cap(ua, 256),
  detail: cap(detail, 500),
});
```

Отдельно — по персональным данным: имя, телефон и email заявителя лежат в журнале
бессрочно и видны на `/admin/logs`. Для работы журнала достаточно факта заявки;
если контакты нужны — они уже есть в письме. Предлагаемая замена
`app/api/inquiry/route.js:104`:

```js
detail: `заявка від ${data.name}`,   // телефон и email остаются в письме
```

- **Как проверить:** POST на `/api/admin/login` с `{"login":"A".repeat(100000),"password":"x"}` — запись в `content/logs/<месяц>.json` должна быть не длиннее ~500 символов в поле `detail`.

---

### [F-05] Ссылка в письме о заявке строится из тела запроса без проверки схемы и домена

- **Категория:** инъекция URL в HTML-письмо (фишинг в доверенном канале)
- **Расположение:** `app/api/inquiry/painting/route.js:11-18` (`safeAbsoluteUrl`), `:81-82`, `:95`, `:105`, `:120`, `:125`
- **Уязвимый код:**

```js
function safeAbsoluteUrl(path) {
  if (!path) return null;
  try {
    return new URL(path, process.env.NEXT_PUBLIC_SITE_URL).toString();
  } catch {
    return null;           // отсекает только то, что вообще не URL
  }
}
...
const imageUrl = safeAbsoluteUrl(work?.img || data.paintingImg);
const pageUrl  = safeAbsoluteUrl(work?.page || data.pageUrl);
...
? `<a href="${escapeHtml(pageUrl || imageUrl)}" ...>
     <img src="${escapeHtml(imageUrl)}" ... />`
```

- **Поток данных:** тело POST `/api/inquiry/painting` → если `workId` не найден в хранилище (`resolveWork` вернул `null` — достаточно прислать чужой или пустой id), берутся `data.pageUrl` и `data.paintingImg` → `safeAbsoluteUrl` → `href`/`src` в HTML-письме, которое открывает владелец сайта.
- **Проверено локально** (безвредно, без запросов наружу):

```
"javascript:alert(1)"        -> "javascript:alert(1)"
"data:text/html,<h1>x</h1>"  -> "data:text/html,<h1>x</h1>"
"//evil.example/pay"         -> "https://evil.example/pay"
"vbscript:msgbox(1)"         -> "vbscript:msgbox(1)"
escapeHtml("javascript:alert(1)") -> "javascript:alert(1)"   // схему не трогает
```

`new URL(x, base)` возвращает абсолютный URL для **любой** схемы, а не только для
относительных путей: `base` используется лишь тогда, когда `x` относительный.
`escapeHtml` здесь тоже не помогает — он экранирует кавычки и угловые скобки, то
есть закрывает выход из атрибута (это работает правильно), но схему `javascript:`
не трогает.

- **Сценарий атаки:** злоумышленник шлёт заявку с несуществующим `workId` и своим `pageUrl`. Владелец получает письмо «Заявка по работе», в котором ссылка «Страница работы» и кликабельная миниатюра ведут на его домен. Это доверенный канал: письмо приходит с настоящего `MAIL_FROM`, выглядит штатно, и от ссылки в нём не ждут подвоха. `javascript:` в большинстве почтовых клиентов не исполнится, но `data:`-ссылка и внешний адрес открываются; `<img src>` с чужим доменом работает как маячок открытия письма.
- **Существующая защита:** частичная. Экранирование HTML на месте (выход из атрибута невозможен), сама работа для письма честно поднимается из хранилища по `workId`, а не берётся из запроса (`:22-43` — это сделано правильно и осознанно). Не закрыто ровно то, что происходит, когда работа **не** нашлась: включается запасной путь на данные из тела.
- **Оценка:** Вероятность 3 / Влияние 3 / Риск **9**.
  Вероятность 3, а не 4-5: точка публичная, но поля `pageUrl` и `paintingImg` клиент сайта не отправляет (модалка шлёт только `workId` — `components/InquiryModal.js:73`), то есть имена полей видны только в серверном коде. Автоматический сканер их не подберёт, целевой злоумышленник — да. Влияние 3: фишинг/маячок в доверенном письме владельца, без доступа к данным.
- **Исправление:** проверять схему и происхождение, а не только «парсится ли»:

```js
// Абсолютный URL относительно NEXT_PUBLIC_SITE_URL. Пропускаем только
// http(s) и только свой домен либо хранилище Vercel Blob: адрес из тела
// запроса иначе пришёл бы в письмо владельцу как есть, вместе со схемой.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://iwankulik.com";
const ALLOWED_HOSTS = new Set([new URL(SITE).host]);
const ALLOWED_HOST_RE = /\.public\.blob\.vercel-storage\.com$/;

function safeAbsoluteUrl(path) {
  if (!path) return null;
  try {
    const url = new URL(path, SITE);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!ALLOWED_HOSTS.has(url.host) && !ALLOWED_HOST_RE.test(url.host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
```

- **Как проверить:** `safeAbsoluteUrl("javascript:alert(1)")`, `safeAbsoluteUrl("//evil.example/x")` и `safeAbsoluteUrl("data:text/html,<b>audit-marker</b>")` возвращают `null`; `safeAbsoluteUrl("/uk/zhyvopys#id")` по-прежнему возвращает адрес на своём домене. В письме при ненайденном `workId` строка «Страница работы» и миниатюра просто отсутствуют — это штатное поведение (`rows.filter` на `:102`).

---

### [F-06] Генератор OG-картинок ходит по произвольному URL и пути из данных админки

- **Категория:** SSRF / чтение файлов сервера
- **Расположение:** `lib/ogImage.js:29-41`
- **Уязвимый код:**

```js
async function readImageSource(src) {
  if (/^https?:\/\//.test(src)) return fetchImage(src);        // произвольный внешний адрес
  if (src.startsWith("/uploads/")) {
    const name = path.basename(src);                            // здесь traversal закрыт
    ...
  }
  try {
    return await readFile(path.join(process.cwd(), "public", src));  // src не нормализуется
  } catch {
    return fetchImage(`${SITE_URL}${src}`);
  }
}
```

- **Поток данных:** PUT `/api/admin/data` → `paintings[].img`, `cycles[].img`, `blogCovers[slug]` → хранилище → `renderOgImage({ background })` при запросе `/{locale}/…/opengraph-image` (маршрут публичный, его дёргают краулеры соцсетей).
- **Сценарий атаки:** учётная запись админа (или компрометация сессии) позволяет записать в `img` либо адрес во внутренней сети/метаданных облака, либо путь вида `../../…` — сервер сам сходит по нему при генерации карточки. Результат уходит в sharp, поэтому прямой выдачи содержимого нет; наблюдаемы факт обращения и разница во времени ответа.
- **Существующая защита:** нет. `validateSiteData` (`lib/siteData.mjs:78-92`) проверяет, что `blogCovers` — плоская карта строк, но не содержимое строк. Для `/uploads/` traversal закрыт через `path.basename`, для остальных путей — нет.
- **Оценка:** Вероятность 2 / Влияние 3 / Риск **6**.
  Вероятность 2: нужна аутентификация админа. Это не «уязвимость, доступная посетителю», а недостающий рубеж на случай, если сессия админа окажется чужой.
- **Исправление:**

```js
async function readImageSource(src) {
  // Источник фона — значение из админки. Допускаем ровно три формы:
  // адрес хранилища Vercel Blob, /uploads/<имя> и /assets/<имя>.
  if (/^https?:\/\//.test(src)) {
    const host = new URL(src).host;
    if (!/\.public\.blob\.vercel-storage\.com$/.test(host)) return null;
    return fetchImage(src);
  }
  if (src.startsWith("/uploads/")) { /* как есть */ }
  if (!src.startsWith("/assets/")) return null;
  const file = path.join(process.cwd(), "public", "assets", path.basename(src));
  try { return await readFile(file); } catch { return fetchImage(`${SITE_URL}${src}`); }
}
```

- **Как проверить:** сохранить в админке обложку со значением `/../../package.json` — `backgroundDataUri` должен вернуть `null` (карточка рисуется на тёмном фоне, `lib/ogImage.js:64-69`), а в консоли не должно быть попытки чтения вне `public/assets`.

---

### [F-07] Нет предварительной проверки размера тела на `/api/admin/login` и `/api/admin/upload`

- **Категория:** отказ в обслуживании / расход ресурсов функции
- **Расположение:** `app/api/admin/login/route.js:37`, `app/api/admin/upload/route.js:43,48`
- **Уязвимый код:**

```js
// login: тело разбирается целиком, до всякой проверки размера
const { login, password } = await request.json().catch(() => ({}));
```

```js
// upload: formData() буферизует весь запрос, лимит проверяется уже после
const form = await request.formData();
const file = form.get("file");
if (file.size > MAX_UPLOAD_BYTES) { ... }
```

- **Поток данных:** тело запроса → память функции.
- **Сценарий атаки:** многомегабайтное тело на `/api/admin/login` (публичная точка) целиком оседает в памяти функции и разбирается JSON-парсером до того, как сработает любая проверка. То же на `/upload`, но там нужна сессия.
- **Существующая защита:** нет. Для форм заявок такая проверка **есть** и сделана правильно — `checkBodySize` (`lib/formGuard.js:33-39`) вызывается до `request.json()`, с объяснением в комментарии ровно про этот случай. На логине её просто не применили.
- **Оценка:** Вероятность 3 / Влияние 2 / Риск **6**.
- **Исправление:** переиспользовать готовую функцию — она уже экспортирована.

```js
// app/api/admin/login/route.js, первой строкой обработчика
import { checkBodySize } from "@/lib/formGuard";
...
export async function POST(request) {
  const oversized = checkBodySize(request);
  if (oversized) return NextResponse.json(oversized.body, { status: oversized.status });
  const ip = getClientIp(request);
  ...
```

Для `/upload` — проверять `content-length` против `MAX_UPLOAD_BYTES` до `request.formData()`.

- **Как проверить:** POST на `/api/admin/login` с телом 1 МБ отдаёт `413 payload_too_large`, и в журнале нет записи `login_fail`.

---

### [F-08] CSP с `'unsafe-inline'` не погасит инъекцию `onerror`/`onload`

- **Категория:** отсутствующий второй рубеж защиты
- **Расположение:** `next.config.mjs:35`
- **Код:**

```js
"script-src 'self' 'unsafe-inline' https://cloud.umami.is",
```

- **Ответ на прямой вопрос раздела 5.3 ТЗ:** **нет, не погасит.** `'unsafe-inline'` в `script-src` разрешает и inline-теги `<script>`, и inline-обработчики событий. Если бы экранирование где-то было пропущено, внедрённые `onerror=`/`onload=` отработали бы — CSP их не остановит.
- **Существующая защита:** частичная, и компромисс задокументирован в самом файле (`next.config.mjs:1-32`): App Router вкладывает RSC-payload 47 инлайновыми скриптами, их содержимое меняется с каждой сборкой; хеши невозможны, а nonce требует отказа от статики на всех 106 страницах. Что политика держит: внешние скрипты (кроме `cloud.umami.is`), утечку данных (`connect-src` замкнут), подмену `<base>`, перенаправление формы, вложение сайта во фрейм. Остальные заголовки на месте: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
- **Оценка:** Вероятность 1 / Влияние 4 / Риск **4**.
  Вероятность 1 — потому что активных XSS-точек в проекте не найдено: это отсутствие страховки, а не дыра. Влияние 4 — если страховка однажды понадобится, её не будет.
- **Исправление:** оставить как есть, но зафиксировать цену решения. Если CSP как второй рубеж когда-нибудь понадобится (появится сторонний виджет, форма отзывов, пользовательский HTML) — перейти на nonce через `proxy.js`, приняв динамический рендер страниц. Вариант дешевле: не трогая политику, добавить `report-uri`/`report-to`, чтобы нарушения были видны.
- **Как проверить:** `curl -sI https://iwankulik.com/uk | grep -i content-security-policy` — политика должна приходить как `Content-Security-Policy` (не Report-Only) на прод-деплое.

---

### [F-09] Слаг и локаль статьи попадают в путь файловой системы без сверки с известным набором

- **Категория:** path traversal (ограниченный)
- **Расположение:** `lib/blog.js:25-27`, `:84-90`; вызов — `app/(site)/[locale]/blog/[slug]/page.js:122`
- **Уязвимый код:**

```js
function postFilePath(locale, slug) {
  return path.join(BLOG_DIR, locale, `${slug}.mdx`);
}
function readFrontmatter(locale, slug) {
  const file = postFilePath(locale, slug);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
```

- **Поток данных:** path-параметры `/{locale}/blog/{slug}` → `getPostMeta(locale, slug)` → `path.join` → `fs.readFileSync`.
- **Сценарий атаки:** закодированные разделители (`%2F`) в сегменте пути могут дать `slug`, выходящий за `blog-content/`. Достижимы только файлы с суффиксом `.mdx`; на продакшене вне `blog-content/` таких файлов нет.
- **Существующая защита:** частичная и косвенная. `locale` проверяется в макете (`app/(site)/[locale]/layout.js:97`) и в OG-маршруте (`opengraph-image.js:35`), но в самой странице статьи — нет; `slug` не проверяется нигде до обращения к ФС. `lib/blogValidation.js` требует от слагов формат `^[a-z0-9]+(?:-[a-z0-9]+)*$`, но это проверка контента на сборке, а не входящего запроса.
- **Оценка:** Вероятность 2 / Влияние 2 / Риск **4**.
  Пропускает ли Next 16 `%2F` внутрь динамического сегмента — по репозиторию не проверить (см. «Не проверено»), поэтому вероятность 2, а не выше.
- **Исправление:** сверять параметры с известным набором до обращения к диску — набор и так вычисляется рядом:

```js
// lib/blog.js
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;   // тот же формат, что требует blogValidation

function readFrontmatter(locale, slug) {
  // Оба значения приходят из адреса. Проверяем до path.join: иначе
  // закодированный разделитель уводит чтение за пределы blog-content.
  if (!locales.includes(locale) || !SLUG_RE.test(String(slug))) return null;
  const file = postFilePath(locale, slug);
  ...
```

- **Как проверить:** `readFrontmatter("uk", "../../package")` и `readFrontmatter("../..", "any")` возвращают `null`; обычная статья по-прежнему читается (`npm run build` даёт то же число страниц).

---

### [F-10] Мутирующие admin-эндпоинты не проверяют `Origin`

- **Категория:** CSRF
- **Расположение:** `lib/adminAuth.js:13-18`, `app/api/admin/upload/route.js:37`, `app/api/admin/logout/route.js:6`
- **Код:**

```js
cookieOptions: { httpOnly: true, secure: NODE_ENV === "production", sameSite: "lax", path: "/" },
```

- **Существующая защита:** частичная, но по сути достаточная. `SameSite=Lax` не отправляет cookie при межсайтовом POST; `PUT /api/admin/data` из HTML-формы вообще недостижим (форма умеет только GET/POST). Остаётся узкое окно «Lax + POST» в Chrome: cookie моложе двух минут отправляется и при межсайтовом POST — то есть теоретически достижимы `/api/admin/upload` и `/api/admin/logout` в первые две минуты после входа. CORS нигде не ослаблен, `Access-Control-Allow-Origin` не выставляется, server actions в проекте нет (`"use server"` не встречается).
- **Оценка:** Вероятность 1 / Влияние 3 / Риск **3**.
- **Исправление:** одна проверка на все мутирующие обработчики:

```js
// lib/adminAuth.js
// Второй рубеж к SameSite=Lax: он оставляет двухминутное окно для
// межсайтового POST со свежей cookie (поведение Chrome «Lax + POST»).
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;                    // не браузерный запрос
  return origin === new URL(request.url).origin;
}
```

- **Как проверить:** POST на `/api/admin/logout` с заголовком `Origin: https://evil.example` при валидной сессии отдаёт 403, без заголовка `Origin` — работает как прежде.

---

## 7.4. Защищено

Перечислено, чтобы при рефакторинге это не сломали.

### SQL / NoSQL-инъекции (5.1) — **неприменимо**

Базы данных в проекте нет: ни ORM, ни драйвера, ни строк подключения. Всё хранение —
JSON в Netlify Blobs / Vercel Blob / локальной ФС (`lib/store.js:20`), доступ по
фиксированным ключам. `$queryRawUnsafe`, `knex.raw`, `sequelize.query` и подобного
в репозитории нет. Первый вектор из инцидента Calorize («SQL-инъекция в поле имя»)
здесь не существует как класс.

### XSS по контекстам (5.2)

| Контекст | Состояние | Механизм |
|---|---|---|
| HTML-тело | Закрыт | React автоэкранирует. `dangerouslySetInnerHTML` ровно два: `components/JsonLd.js:8` (JSON с экранированным `<`) и `app/not-found.js:127` (константа + `JSON.stringify(locales)`). Пользовательских данных ни там, ни там нет |
| HTML-атрибут | Закрыт | Ручной сборки HTML-строк на страницах нет; `{...userProps}` нигде не встречается |
| JS-строка | Закрыт | `eval`, `new Function`, `setTimeout("строка")` отсутствуют. Инлайн `theme-init` (`layout.js:110-117`) — константа. `JSON.stringify` внутри `<script>` есть в двух местах, и в обоих `<` экранирован |
| URL | Закрыт на страницах | Все `href` — либо `next/link` с шаблоном `/${locale}/…`, либо `tel:`/`mailto:` из данных админки. Схемы из пользовательского ввода в `href` на страницах не попадают (в письме — попадают, см. F-05) |
| CSS | Закрыт | Инлайн-стили только со статическими значениями; пользовательский ввод в `style`/`url()` не попадает |
| Markdown / rich text | **Неприменимо** | MDX пишет только владелец, файлы лежат в git. `blockJS: false` (`lib/blog.js:252`) выключен осознанно и задокументирован — на пользовательский контент этот путь не рассчитан и не используется |
| SVG | **Неприменимо** | Загрузка SVG невозможна: `detectImageType` (`app/api/admin/upload/route.js:16-35`) принимает только JPEG/PNG/WebP по magic bytes |
| Метаданные | Закрыт | `<title>`, OG, JSON-LD формирует Next с автоэкранированием; JSON-LD дополнительно экранирует `<` |

**Stored XSS в «тихих» местах** — проверено отдельно, как требует раздел 9 ТЗ:

- **Админка/CRM.** `/admin` и `/admin/logs` — React-компоненты, значения выводятся
  как `{entry.detail}`, `{entry.user}`, `{entry.ip}` (`app/(admin)/admin/logs/page.js:90-94`).
  XSS через журнал (в т.ч. через подставленный `login` или User-Agent атакующего) закрыт.
- **HTML-письма.** Все три шаблона (заявка, заявка по работе, уведомления о входе
  и о переборе) прогоняют каждое значение через `escapeHtml` — `lib/mail.js:58-65`,
  и в HTML-теле, и в атрибутах. Проверено локально: `escapeHtml("<b>audit-marker</b> ' \" & < >")`
  → `&lt;b&gt;audit-marker&lt;/b&gt; &#39; &quot; &amp; &lt; &gt;` — выход из атрибута
  невозможен. Единственное, что не закрыто, — схема URL (F-05) и тема письма (F-03).
- **Мессенджеры.** Уведомлений в Telegram и подобных нет.
- **CSV / Excel / PDF.** Экспорта нет — **CSV formula injection неприменима**.

**DOM-based XSS** — закрыт. `location.search` и `location.hash` читаются в трёх местах
(`components/Header.js:31,83`, `components/Gallery.js:41,64`), и ни в одном значение не
пишется в DOM: `Gallery` использует `?w=` только как ключ для `findIndex` по массиву
работ, `Header` — как суффикс для `next/link`. `document.referrer` и `postMessage` не
используются.

### Сессии, cookies, аутентификация (5.4)

- `iron-session`: cookie зашифрована, `httpOnly`, `secure` на проде, `SameSite=Lax`, TTL 7 дней (`lib/adminAuth.js:9-19`).
- Токенов в `localStorage`/`sessionStorage` нет — там лежит только выбранная тема.
- bcrypt cost 12 (`scripts/hash-password.mjs:12`); пароли в коде и в git отсутствуют.
- Сравнение логина — константное по времени, с добиванием буферов (`lib/adminAuth.js:42-51`); для несуществующего логина всё равно выполняется `bcrypt.compare` с фиктивным хешем (`:56,64`) — по времени ответа не отличить «нет такого логина» от «неверный пароль».
- Защита от перебора: 5 попыток → блок 15 минут → при повторе 1 час (`lib/rateLimit.js:12-14,122-134`), плюс фиксированная задержка 1 с на каждую неудачу и одинаковый текст ошибки.
- Ротация сессии при входе: `session.destroy()` перед выдачей новой (`app/api/admin/login/route.js:103-107`).
- Письмо при входе с нового устройства (отпечаток = SHA-256 от подсети /24 + UA, `lib/deviceTracking.js:15-22`) и письмо в момент срабатывания блокировки — причём ровно один раз, а не на каждую последующую попытку (`app/api/admin/login/route.js:61`).
- Сброса пароля нет как функции — соответствующий класс проблем отсутствует.

### CSRF (5.5)

Мутаций через GET нет; все изменяющие операции — POST/PUT. `SameSite=Lax` + JSON-тело
закрывают основной вектор. CORS нигде не ослаблен, server actions отсутствуют.
Остаточное окно — F-10.

### Валидация ввода (5.6)

Серверная валидация есть и не подменяется клиентской: длины полей, формат email и
телефона (`lib/formGuard.js:118-126`), ограничение тела 64 КБ **до** разбора JSON
(`:33-39`), проверка структуры данных сайта (`lib/siteData.mjs:78-92`) — причём одна и та
же для админки и для `scripts/push-data.mjs`, чтобы заливка не могла пронести то, что
отсеивает админка. Пробелы — F-03 (не все поля в списке лимитов) и F-07 (логин).

### Защита от ботов (5.7)

Три независимых рубежа на публичных формах, все в одной точке входа `guardInquiry()`:

1. **Honeypot** — поле `website`, скрытое стилями, а не атрибутом `hidden` (`components/OrderForm.js:122`, проверка — `lib/formGuard.js:85-87`).
2. **Подписанный одноразовый токен формы** — HMAC-SHA256 от `timestamp + nonce`, сравнение `timingSafeEqual`, окно от 3 секунд до 2 часов, nonce гасится после первой удачной заявки (`lib/formGuard.js:45-83,142-146,166`). Комментарий на `:41-44` фиксирует, что nonce добавили именно после того, как обнаружили, что одним токеном проходили шесть заявок подряд. Отдельно отмечу правильную деталь: токен гасится **после** прохождения всех проверок (`:163-166`), иначе посетитель, опечатавшийся в телефоне, со второй попытки получал бы «отправлено» без письма.
3. **Rate limit** — 6 заявок в час с адреса (`:15-16,101-113`).

Ответ боту на honeypot и на неверный тайминг — одинаковый `200 {ok:true}`, чтобы не
подсказывать, на чём его поймали. Массовой регистрации нет — регистрации нет вообще.

### Загрузка файлов (5.8)

- Тип — по magic bytes, не по расширению и не по `Content-Type` (`app/api/admin/upload/route.js:16-35`).
- Каждое изображение пересобирается через sharp: EXIF-rotate → вписать в 2500×2500 → **всегда** WebP q85 (`:68-79`). Это уничтожает любую вложенную полезную нагрузку и метаданные; файл, который sharp не декодирует, отвергается.
- Лимит 15 МБ.
- Имя файла генерирует сервер: `Date.now()` + приведённое к `[a-z0-9.]` исходное имя (`lib/store.js:254-255`) — path traversal через имя невозможен.
- Отдача: `path.basename` + whitelist расширений, всё остальное → 404 (`app/uploads/[file]/route.js:11-13`).
- SVG и HTML загрузить нельзя в принципе.

### Авторизация и доступ к объектам (5.9)

- Пользовательских объектов нет → IDOR как класс отсутствует.
- Каждый обработчик под `/api/admin/*` проверяет сессию сам, не полагаясь на маршрутизацию.
- **Mass assignment закрыт осознанно и в нескольких местах:** цена нормализуется на сервере (`app/api/admin/data/route.js:55`); `cycle` принимается только как id существующего цикла, иначе `null` (`:57`); `id` и `slug` циклов берутся из предыдущей версии, клиент их переписать не может (`:64-66`); номера работ закрепляет сервер через `preserveCodes` (`:71`), поэтому перестановка или редактирование их не меняют. Для писем по работам данные поднимаются из хранилища по `workId`, а не берутся из тела запроса — с прямым комментарием, что так сделано на случай отправки формы в обход сайта (`app/api/inquiry/painting/route.js:22-24`).

### SSRF и open redirect (5.10)

Open redirect закрыт: `proxy.js` строит только относительные пути через
`request.nextUrl.clone()` + присваивание `pathname` (`:89-92`), внешний адрес подставить
нельзя. Параметров `redirect`/`next`/`returnUrl`/`callbackUrl` в проекте нет.
Серверных `fetch` по пользовательскому URL нет; по URL из данных админки — есть, F-06.

### Секреты и утечки (5.11)

- В репозитории и в истории git нет ни одного `.env`, кроме `.env.example` (проверено `git log --all --diff-filter=A`); `.env*` в `.gitignore`.
- Захардкоженных ключей нет. `DUMMY_HASH` (`lib/adminAuth.js:56`) — намеренная заглушка, не учётные данные.
- Под `NEXT_PUBLIC_` только адрес сайта. В `next.config.mjs` через `env` инлайнятся два флага (`IS_NETLIFY_BUILD`, `IS_PRODUCTION_DEPLOY`) — секретов не содержат.
- Клиентские компоненты `process.env` не читают вообще (проверено по всем файлам с `"use client"`).
- `productionBrowserSourceMaps` не включён → source maps на прод не уезжают.
- API не возвращает лишнего: хеши паролей нигде не отдаются, `/api/admin/data` доступен только по сессии, тексты ошибок обобщённые (`"bad data"`, `"save_failed"`), stack trace в ответах нет. В журнал пишется код и сообщение ошибки, обрезанные до 220 символов (`app/api/admin/data/route.js:97`), но не тело запроса — с прямым комментарием почему.
- `robots.txt` закрывает `/admin` и `/api` (`app/robots.js:5`), макет админки помечен `robots: {index:false}`.

### Логирование (5.13)

Логируется всё, что нужно для разбора инцидента: неудачные входы (с IP, временем,
маршрутом и использованным логином), срабатывания honeypot/тайминга/повторного
nonce/лимита (`spam_blocked` с точной причиной), отклонённые сохранения с именем
непрошедшей проверки, сбои записи и чтения хранилища, несостоявшиеся письма. Пароли и
токены в журнал не попадают. Владелец видит это на `/admin/logs` с фильтрами по месяцу
и действию; оба фильтра проходят whitelist (`app/(admin)/admin/logs/page.js:44-45`).
Есть два активных оповещения на почту: вход с нового устройства и начавшийся перебор.
Вывод журнала экранирован React. Остаточные проблемы — F-04.

---

## 7.5. Не проверено

| Что | Почему | Что нужно, чтобы проверить |
|---|---|---|
| Значения прод-переменных: длина и уникальность `SESSION_SECRET`, состав `ADMIN_USERS`, стойкость самого пароля | Нет доступа к настройкам Netlify/Vercel. Важно: `SESSION_SECRET` — ключ и для шифрования сессии, и для HMAC токена форм (`lib/formGuard.js:11`, `SECRET = ... \|\| ""`). Если он не задан, подпись считается пустым ключом, и токен форм подделывается | Подтверждение, что переменная задана на обеих площадках и длиннее 32 символов |
| Реально ли отдаются заголовки безопасности на проде, и покрывают ли они статику `/assets/*`, `/og/*` | `headers()` из `next.config.mjs` применяется к ответам Next; файлы из `public/` на Netlify отдаёт статический слой — по комментарию в `netlify.toml:16-18` их задевает только этот файл, где сейчас задан лишь `Cache-Control`. CLAUDE.md прямо предупреждает, что локальный `next start` для таких выводов негоден | `curl -sI https://iwankulik.com/uk` и `curl -sI https://iwankulik.com/assets/hero-work.webp` на живом деплое |
| Перезаписывает ли Netlify присланный клиентом `x-nf-client-connection-ip` | Поведение платформы по коду не видно. От этого зависит, применим ли F-02 к основному деплою или только к Vercel | Запрос к прод-деплою с подставленным заголовком и сверка IP в `/admin/logs` |
| Пропускает ли Next 16 `%2F` внутрь динамического сегмента | От этого зависит реальная достижимость F-09. Локальная проверка запрещена тем же правилом CLAUDE.md про недостоверность `next start` | Запрос вида `/uk/blog/..%2F..%2Fsomething` к деплою |
| Достижим ли уязвимый код Image Optimization (F-01) на Netlify/Vercel | Обе площадки обслуживают `/_next/image` собственным Image CDN; исполняется ли при этом код Next — по репозиторию не установить | Не требуется для действия: обновление всё равно обязательно |
| Санирует ли Resend CRLF в теме письма | Поведение внешнего API. Сейчас проект на него полагается неявно | Достаточно исправления F-03 — тогда вопрос снимается |
| Тесты из раздела 8 ТЗ | Тестового фреймворка в проекте нет (`package.json`: только `dev`/`build`/`start`/`lint`), локального окружения с заполненными переменными тоже. Проверил то, что можно проверить чистыми функциями: `safeAbsoluteUrl` и `escapeHtml` прогнаны на маркерных строках — результаты приведены в F-05 | `npm i -D vitest` + минимальный набор тестов (см. 7.6) |

---

## 7.6. Общие рекомендации

1. **Обновление зависимостей — сейчас.** `npm i next@^16.3.5 sharp@^0.35.4 && npm audit fix`.
   Это единственная находка уровня «сделать до всего остального». Учитывая, что CI в
   проекте нет (`CLAUDE.md`, раздел Deployment), стоит завести хотя бы ежемесячную
   ручную проверку `npm audit` — либо один workflow на `npm audit --audit-level=high`.

2. **Валидация — в одном списке.** `LENGTH_LIMITS` уже устроен правильно: один
   объект, один цикл, одна точка входа `guardInquiry()`. Проблема только в том, что
   новые поля туда не дописали. Практическое правило: поле, которое читает роут,
   обязано быть в `LENGTH_LIMITS`. Если захочется формальную схему — `zod` здесь
   избыточен, хватит списка.

3. **Обрезка на границе хранилища.** `lib/auditLog.js` — единственная точка записи
   в журнал; обрезать длины нужно там, а не в вызывающих роутах. Так следующий
   добавленный тип события окажется защищён автоматически.

4. **Один доверенный источник IP.** F-02 — частный случай общего правила: заголовок,
   который на текущей площадке не выставляет прокси, доверия не заслуживает.
   Выбирать источник по площадке, а не перебором.

5. **Проверять схему URL, а не только парсинг.** F-05 и F-06 — одна и та же ошибка в
   двух местах: `new URL()` считается проверкой, хотя он принимает любую схему.
   Стоит завести общий `lib/safeUrl.js` c whitelist схем и хостов и звать его из
   обоих мест.

6. **CSP.** Компромисс с `'unsafe-inline'` обоснован и задокументирован — менять его
   сейчас незачем. Но стоит записать в том же комментарии вывод из этого аудита:
   защиты от внедрённых обработчиков событий у сайта нет, и появление любого места,
   где выводится пользовательский HTML, потребует сначала перевести политику на nonce.

7. **Автотесты безопасности.** Тестов в проекте нет совсем, а три функции здесь —
   чистые и тестируются в пять строк. Минимальный набор, который стоит того:

```js
// safeUrl: схема и домен
expect(safeAbsoluteUrl("javascript:alert(1)")).toBeNull();
expect(safeAbsoluteUrl("//evil.example/x")).toBeNull();
expect(safeAbsoluteUrl("/uk/zhyvopys#id")).toBe("https://iwankulik.com/uk/zhyvopys#id");

// escapeHtml: маркер из раздела 8 ТЗ
expect(escapeHtml("<b>audit-marker</b> ' \" & < >"))
  .toBe("&lt;b&gt;audit-marker&lt;/b&gt; &#39; &quot; &amp; &lt; &gt;");

// formGuard: длины и одноразовость токена
expect(validateInquiryFields({ subject: "x".repeat(5000) })).toBe("too_long");
```

8. **Персональные данные.** Имя, телефон и email заявителя сейчас лежат в журнале
   бессрочно и видны на `/admin/logs`. Для журнала достаточно факта заявки — контакты
   уже есть в письме. Заодно стоит решить, сколько месяцев хранить блобы `logs/*`:
   сейчас они не удаляются никогда.

---

## 9. Критерии готовности

- [x] Этап 0 выполнен, карта точек ввода/вывода в разделе 7.1
- [x] Каждый пункт раздела 5 отмечен: 5.1 неприменимо · 5.2 защищено (кроме письма, F-05) · 5.3 F-08 · 5.4 защищено · 5.5 F-10 · 5.6 F-03, F-07 · 5.7 защищено · 5.8 защищено · 5.9 защищено · 5.10 F-06 · 5.11 защищено, F-01 · 5.12 F-01 · 5.13 F-04
- [x] У каждой находки есть файл, строка, оценка риска и конкретное исправление
- [x] Админка, email-шаблоны и экспорт проверены отдельно как места stored XSS (экспорта нет — отмечено как неприменимо)
- [x] Отчёт сохранён в `SECURITY_AUDIT_REPORT.md`
- [x] Код не изменялся
