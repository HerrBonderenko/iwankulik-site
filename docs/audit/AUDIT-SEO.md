# AUDIT-SEO

Аудит SEO-метаданных публичной части. Только чтение и анализ, код не изменялся.

## Условия замера

- Источник данных — **собранный HTML**, не исходники. Все 90 публичных URL сайта
  запрошены у работающего dev-сервера и разобраны регулярными выражениями по
  готовому ответу. Сборка не запускалась, `.next` не трогался.
- Дата/время замера: **2026-09-08, 21:09–21:15 UTC**.
- Хост: `http://localhost:3000`. В `.env.local` стоит
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, поэтому все canonical, hreflang,
  `og:url` и адреса в JSON-LD ниже приведены с этим origin. В `.env.example`
  задано `https://iwankulik.com` — на проде подставится он. Это артефакт среды,
  а не дефект разметки; там, где это важно, оговорено отдельно.
- **Внешние валидаторы (Google Rich Results Test, validator.schema.org) запустить
  было нельзя**: `localhost:3000` для них недостижим. Часть C — проверка по
  документированным обязательным и рекомендуемым полям Google, выполненная
  скриптом по извлечённому JSON-LD. Это не замена прогона по живому URL после
  деплоя, и я это не выдаю за него.
- Параллельная сессия правит код. За время аудита изменился
  `app/(site)/[locale]/cycles/[slug]/page.js`: описание цикла теперь берётся из
  первого предложения текста цикла, а шаблон `seo.cycles.itemDescription` стал
  запасным. Цифры ниже соответствуют состоянию на момент замера.

Покрытие: 90 URL = 5 локалей × (главная, /zhyvopys, /cycles, /pro-mene,
/kontakty, /blog, 3 категории блога, 5 циклов, 4 статьи) + страница 404.
Ровно столько же URL в `sitemap.xml`.

---

## ЧАСТЬ A — Что есть на каждой странице

### A1. Сводная матрица

Проверено на всех 90 URL. Значения в колонках «есть» одинаковы для всех
пяти локалей, если не сказано иное.

| Страница | Что есть | Чего нет |
| --- | --- | --- |
| **Главная** `/{loc}` | title (17–28 зн.), description (117–140), canonical абс. самореферентный, hreflang ×6, og:title/description/url/site_name/locale/type=website, og:image + width/height/alt, og:locale:alternate ×4, twitter:card=summary_large_image/title/description/image | `og:image` и `twitter:image` ведут на `/og/default.jpg` → **307 → 404** (см. A3); meta robots; theme-color; twitter:site; twitter:creator; twitter:image:alt |
| **`/{loc}/zhyvopys`** | всё то же; собственный `og:image` = `/og/zhyvopys.jpg`; title 36 зн., desc 141 | `/og/zhyvopys.jpg` → **307 → 404**; robots; theme-color; twitter:site/creator/image:alt |
| **`/{loc}/cycles`** | всё то же; title 28, desc 106 | og:image → 404; собственной картинки нет (общая `default.jpg`); robots; theme-color; twitter:site/creator/image:alt |
| **`/{loc}/cycles/[slug]`** ×5 | всё то же; title 21–32; desc 36–161 (из текста цикла) | og:image → 404; **изображение самого цикла в og не подставляется** — у всех пяти общая `default.jpg`; robots; theme-color |
| **`/{loc}/pro-mene`** | всё то же; title 31, desc 100–163 | og:image → 404; портрет художника в og не подставляется; robots; theme-color |
| **`/{loc}/kontakty`** | всё то же; title 20–21, desc 84–101 | og:image → 404; robots; theme-color |
| **`/{loc}/blog`** | всё то же; title 17–19, desc 57–66 | og:image → 404; robots; theme-color |
| **`/{loc}/blog/[slug]`** ×4 | всё то же; **`og:type=article`** ✓; `og:image` = обложка статьи, **отдаётся 200** ✓; title 30–65; desc 102–167; hreflang ×6 | `og:image:width/height` жёстко `1200×630`, реальные файлы `1280×960`, `900×630`, `900×756`; нет `article:published_time`, `article:modified_time`, `article:author`, `article:section`; robots; theme-color; twitter:site/creator/image:alt |
| **`/{loc}/blog/[категория]`** ×3 | всё то же; **hreflang с локализованными слагами** (`/uk/blog/tsykly` ↔ `/de/blog/zyklen`) ✓; title 22–35 | og:image → 404; description дублирует индекс блога (см. B); robots; theme-color |
| **404** (`/uk/no-such-page-xyz`) | **`<meta name="robots" content="noindex">`** ✓ | `<title>` отсутствует полностью; description; canonical; hreflang; весь блок og:*; весь блок twitter:*; theme-color; **`<html>` без атрибута `lang`** (на остальных 90 страницах `lang` корректный) |

### A2. Длины title и description

**title.** Все 90 страниц имеют title. За 60 знаков выходят две:

| URL | Длина | title |
| --- | --- | --- |
| `/en/blog/majster-i-margaryta-cykl` | 63 | The Master and Margarita: seven hundred canvases from one novel |
| `/de/blog/majster-i-margaryta-cykl` | 65 | Der Meister und Margarita: siebenhundert Leinwände zu einem Roman |

Остальные 88 — от 17 до 49 знаков. В зоне 55–60 нет ни одной.

**description.** Все 90 страниц имеют description. Распределение относительно
целевого коридора 150–160:

| Диапазон | Страниц |
| --- | --- |
| < 100 знаков | **43** |
| 100–149 | 39 |
| 150–160 (целевой) | **3** |
| > 160 | 5 |

Длиннее 160:

| URL | Длина |
| --- | --- |
| `/de/blog/yak-kupyty-kartynu-napryamu` | 167 |
| `/de/blog/majster-i-margaryta-cykl` | 166 |
| `/ru/pro-mene` | 163 |
| `/en/blog/majster-i-margaryta-cykl` | 162 |
| `/de/cycles/don-quixote` | 161 |

Самые короткие (все — страницы циклов и категорий блога):

| URL | Длина |
| --- | --- |
| `/en/cycles/critique-of-power` | 32 |
| `/pl/cycles/critique-of-power` | 34 |
| `/uk/cycles/critique-of-power` | 36 |
| `/uk/cycles/animal-farm` | 37 |
| `/de/cycles/critique-of-power` | 37 |
| `/ru/cycles/critique-of-power` | 38 |
| `/en/cycles/animal-farm` | 41 |

### A3. `og:image` — измеренный факт

`/og/default.jpg` и `/og/zhyvopys.jpg` в браузере **не отдаются**:

```
GET /og/default.jpg   → 307 Temporary Redirect, location: /en/og/default.jpg
GET /en/og/default.jpg → 404
GET /og/zhyvopys.jpg  → 307 → /en/og/zhyvopys.jpg → 404
```

Механизм: `proxy.js:53` (в Next.js 16 это переименованный middleware) исключает
из matcher `api`, `admin`, `_next`, `assets`, `uploads`, `blog/`, `favicon.ico`,
`sitemap.xml`, `image-sitemap.xml`, `robots.txt`, `manifest.webmanifest`,
`icon.svg`, `apple-icon.png`, `icon-512.png` — **`og` в списке нет**, поэтому
локальный редирект перехватывает и эти файлы.

Контроль: `/assets/auth-studio.jpg` → 200, `/icon-512.png` → 200 (оба в списке
исключений). Сами файлы на диске в порядке: `public/og/default.jpg` и
`public/og/zhyvopys.jpg` существуют и имеют ровно 1200×630.

Затронуто **70 из 90 страниц**: 65 ссылаются на `default.jpg`, 5 — на
`zhyvopys.jpg`. Работающий `og:image` только у 20 страниц статей блога.

В `public/og/` лежит также `rozpys.jpg` и папка `rozpys/` — раздел `/rozpys`
из проекта удалён, на эти файлы ничего не ссылается.

### A4. hreflang

Одинаково на всех 90 страницах: **6 ссылок** — `uk`, `en`, `pl`, `de`, `ru`,
`x-default`. Ни одной страницы с другим числом.

- `x-default` везде ведёт на польскую версию (`lib/seo.js:9`).
- Все адреса абсолютные.
- Категории блога: слаг локализован в каждой альтернативе — `/uk/blog/tsykly`,
  `/en/blog/cycles`, `/pl/blog/cykle`, `/de/blog/zyklen`, `/ru/blog/tsikly`.
- Механизм сужения hreflang для статей, переведённых не на все языки
  (`getAvailableLocales`, `lib/seo.js:20-27`), в разметке присутствует, но
  сейчас не задействован: все 4 статьи есть во всех 5 локалях.
- Обратные ссылки взаимны: каждая из пяти версий перечисляет все пять.

**Расхождение**: `x-default` объявляет польскую версию точкой входа по умолчанию,
а корень сайта ведёт себя иначе. `proxy.js:4` задаёт `DEFAULT = "en"`:

```
GET /                                  → 307 → /en
GET / (Accept-Language: uk-UA)         → 307 → /uk
GET / (Cookie: locale=de)              → 307 → /de
```

Редирект временный (307), не постоянный.

### A5. canonical

Все 90 — абсолютные и самореферентные, совпадают с адресом страницы посимвольно.
Ни одного canonical на чужой URL, ни одного относительного, ни одного отсутствующего.
`/uk/` (со слэшем) отдаёт 308 на `/uk` ✓.

### A6. meta robots

`noindex` стоит ровно в одном месте — на 404 (`app/not-found.js`, отдаётся
Next.js автоматически). Оправдан.

На остальных 90 страницах тега `robots` нет вовсе, то есть действует
`index, follow` по умолчанию. Страниц, которые индексируются, но не должны бы,
среди публичных не обнаружено: `/admin` и `/api` закрыты в robots.txt и
исключены из matcher прокси.

### A7. theme-color

`<meta name="theme-color">` **отсутствует на всех 91 странице**, включая 404.
Экспорта `viewport` в проекте нет. В `app/manifest.js:8-9` заданы
`theme_color: "#1a1a1a"` и `background_color: "#ffffff"` — ни одно из значений
не совпадает с фоном сайта (`--bg` = `#171614` в тёмной теме, `#FDFBF7` в светлой).

---

## ЧАСТЬ B — Дубли и пустоты

### B1. Дубли title

Пустых или отсутствующих title нет. Обрезаемых в выдаче (>60) — две (см. A2).

Полностью совпадающие title на разных URL — 3 группы, 8 страниц:

| title | URL | Причина |
| --- | --- | --- |
| `Blog — Iwan Kulik` | `/en/blog`, `/pl/blog`, `/de/blog` | строка `seo.blog.title` в трёх словарях идентична |
| `Stańczyk — Iwan Kulik` | `/en/cycles/stanczyk`, `/pl/cycles/stanczyk`, `/de/cycles/stanczyk` | имя цикла не переводится, шаблон одинаков |
| `Kontakt — Iwan Kulik` | `/pl/kontakty`, `/de/kontakty` | `seo.contacts.title` совпадает в pl и de |

Все восемь URL связаны корректным взаимным hreflang, то есть это межъязыковые
дубли, а не дубли внутри одного языка.

Внутри одной локали совпадающих title нет.

### B2. Дубли description

Пустых description нет. Есть **5 групп по 4 страницы — 20 из 90**: индекс блога
и все три категории блога в каждой локали получают одну и ту же строку
`seo.blog.description`.

| Описание | Страницы |
| --- | --- |
| «Статті про олійний живопис, техніку та мистецтво від Івана Куліка.» | `/uk/blog`, `/uk/blog/tsykly`, `/uk/blog/tehnika`, `/uk/blog/kolektsionuvannia` |
| «Articles on oil painting, technique and art from Iwan Kulik.» | `/en/blog`, `/en/blog/cycles`, `/en/blog/technique`, `/en/blog/collecting` |
| «Artykuły o malarstwie olejnym, technice i sztuce od Iwana Kulika.» | `/pl/blog`, `/pl/blog/cykle`, `/pl/blog/technika`, `/pl/blog/kolekcjonowanie` |
| «Artikel über Ölmalerei, Technik und Kunst von Iwan Kulik.» | `/de/blog`, `/de/blog/zyklen`, `/de/blog/technik`, `/de/blog/sammeln` |
| «Статьи о масляной живописи, технике и искусстве от Ивана Кулика.» | `/ru/blog`, `/ru/blog/tsikly`, `/ru/blog/tehnika`, `/ru/blog/kollektsionirovanie` |

Источник — `app/(site)/[locale]/blog/[slug]/page.js:58`: ветка категории
подставляет `t.seo.blog.description` без изменений.

Других дублей description на сайте нет: описания циклов и статей уникальны.

### B3. title без имени художника

**20 из 90** — все страницы статей блога, во всех пяти локалях:

| Локаль | title |
| --- | --- |
| uk | Як доглядати за картиною олією · Майстер і Маргарита: сімсот полотен одного роману · Олія на полотні: як влаштована картина · Як купити картину олією напряму в художника |
| en | How to care for an oil painting · The Master and Margarita: seven hundred canvases from one novel · Oil on canvas: how a painting is built · Buying an oil painting directly from the artist |
| pl | Jak dbać o obraz olejny · Mistrz i Małgorzata: siedemset płócien jednej powieści · Olej na płótnie: jak zbudowany jest obraz · Jak kupić obraz olejny bezpośrednio od artysty |
| de | Wie man ein Ölgemälde pflegt · Der Meister und Margarita: siebenhundert Leinwände zu einem Roman · Öl auf Leinwand: wie ein Gemälde aufgebaut ist · Ein Ölgemälde direkt beim Künstler kaufen |
| ru | Как ухаживать за картиной маслом · Мастер и Маргарита: семьсот полотен одного романа · Масло на холсте: как устроена картина · Как купить картину маслом напрямую у художника |

Источник — `blog/[slug]/page.js:69`: `title: post.title` подставляется как есть.
Для сравнения, соседняя ветка категорий в том же файле (строка 57) собирает
`«{Категория} — Блог | Иван Кулик»`, то есть внутри одного файла две разные схемы.

Остальные 70 страниц имя содержат.

---

## ЧАСТЬ C — Structured data

Все блоки JSON-LD распарсились без синтаксических ошибок (проверено
`JSON.parse` по каждому блоку на каждой странице).

### C1. Матрица типов по страницам

| Тип | Главная | zhyvopys | cycles | cycles/[slug] | pro-mene | kontakty | blog | blog/[slug] | blog/[cat] | 404 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Person | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Organization | — | — | — | — | — | — | — | вложен в `Article.publisher` | — | — |
| LocalBusiness | ✓ | — | — | — | — | — | — | — | — | — |
| BreadcrumbList | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (4 уровня) | ✓ | — |
| CollectionPage | — | ✓ | — | — | — | — | ✓ | — | ✓ | — |
| ItemList | — | ✓ (внутри CollectionPage) | — | — | — | — | ✓ | — | ✓ | — |
| Product + Offer | — | ✓ ×7 | — | — | — | — | — | — | — | — |
| Article | — | — | — | — | — | — | — | ✓ | — | — |
| FAQPage | — | — | — | — | — | — | — | ✓ (4 вопроса) | — | — |
| **WebSite + SearchAction** | **—** | **—** | **—** | **—** | **—** | **—** | **—** | **—** | **—** | **—** |
| Блоков всего | 2 | 10 | 2 | 2 | 2 | 2 | 3 | 4 | 3 | 0 |

Отсутствуют на всём сайте: `WebSite` (и вместе с ним `SearchAction`), отдельный
узел `Organization`, `ImageObject` для работ, `VisualArtwork`, `Offer` с
`OutOfStock` (ветка есть в коде, но в текущих данных не срабатывает — см. C3).

### C2. Ошибки (проверка по обязательным полям Google)

| Страница | Узел | Проблема |
| --- | --- | --- |
| `/{loc}/zhyvopys` | Product «Батальна сцена» (К-003) | нет ни `offers`, ни `review`, ни `aggregateRating` — Google требует хотя бы одно из трёх |
| `/{loc}/zhyvopys` | Product «Батальна сцена, фрагмент» (К-004) | то же |
| `/{loc}/zhyvopys` | ItemList | у 7 из 7 `ListItem` нет `url` / `item` — только `name` и `image` |
| `/{loc}/blog` | ItemList | у 4 из 4 `ListItem` нет `url` / `item` |
| `/{loc}/blog/[кат.]` | ItemList | у всех `ListItem` нет `url` / `item` |

Причина первых двух: `lib/schema.js:125-138` добавляет `offers` только если у
работы заполнена цена. В `content/data.json` из 7 работ цена есть у 5. Работа
К-003 при этом имеет `status: "available"`, то есть продаётся, но в разметке
предложения не имеет.

### C3. Предупреждения (рекомендуемые поля)

**Person** — на всех 90 страницах, `lib/schema.js:7-14`:

| Есть | Нет |
| --- | --- |
| `name`, `alternateName`, `jobTitle`, `url` | `@id` (узлы на 90 страницах не связаны между собой), `image`, `sameAs` — объявлен, но это пустой массив `[]`, `address`, `birthDate`, `nationality` |

`url` = `SITE_URL` без локали, то есть адрес, который отдаёт 307.

**LocalBusiness** — только на главной, `lib/schema.js:38-53`:

| Есть | Нет |
| --- | --- |
| `@type`, `@id`, `name`, `image`, `address` (`addressLocality: Warszawa`, `addressCountry: PL`), `areaServed` (8 стран), `sameAs` (пустой) | `url`, `telephone`, `priceRange`, `openingHoursSpecification`, `geo`, `streetAddress`, `postalCode` |

Тип `LocalBusiness`, не более узкий `ArtGallery`. `image` указывает на
`/og/default.jpg` — файл, который отдаёт 404 (см. A3).

**Product / Offer** — 7 работ × 5 локалей:

| Есть | Нет |
| --- | --- |
| `name` (переведено), `image` (абсолютный), `description` (техника + размер + год), `sku` (К-001…К-007), `brand` (Person) | `url` у самого Product |
| у 5 из 7: `offers` с `priceCurrency: EUR`, `price`, `availability: InStock`, `url` (`?w=…`), `seller` | `priceValidUntil`, `itemCondition`, `hasMerchantReturnPolicy`, `shippingDetails` |

`Offer.url` ведёт на `/{loc}/zhyvopys?w=<id>` — это не отдельный документ:
canonical такого адреса равен `/{loc}/zhyvopys`, то есть все 7 товаров указывают
на одну страницу. Отдельных URL у работ на сайте нет, в sitemap их тоже нет
(см. D1). Ветка `availability: OutOfStock` (`lib/schema.js:135`) в текущих данных
не выдаётся ни разу: единственная работа со статусом `collection` (К-004) не
имеет цены, поэтому у неё вообще нет `offers`.

**Article** — 4 статьи × 5 локалей, `lib/schema.js:55-72`:

| Есть | Нет / замечания |
| --- | --- |
| `headline` (30–65 зн., лимит 110 соблюдён), `description`, `image` (массив), `datePublished`, `dateModified`, `author` (Person + url), `publisher` (Organization + logo), `mainEntityOfPage` | `datePublished` / `dateModified` — только дата без времени и таймзоны (`2026-09-08`); `author` без `@id`; `publisher.logo` без `width`/`height` и указывает на `/og/default.jpg` → 404; тип `Article`, не `BlogPosting` |

`dateModified` равен `datePublished` у всех четырёх статей.

**BreadcrumbList** — на 85 страницах (нет только на главных и 404). Все элементы
имеют `position`, `name`, `item` с абсолютным URL. Замечаний нет.

**FAQPage** — только на `/{loc}/blog/majster-i-margaryta-cykl`, 4 вопроса,
у всех есть `name` и `acceptedAnswer.text`. Структурных замечаний нет.
Фактическая справка: с августа 2023 Google показывает FAQ-сниппеты только
для государственных и медицинских сайтов — разметка валидна, но сниппета не даст.

**CollectionPage** — на `/zhyvopys`, `/blog`, `/blog/[кат.]`:

| Есть | Нет |
| --- | --- |
| `name`, `description`, `url`, `about` (Person), `mainEntity.ItemList` с `position`, `name`, `image` | `url` / `item` у каждого `ListItem`, `numberOfItems` у `ItemList` |

Итого по проверке: **5 уникальных ошибок**, **72 уникальных предупреждения**.

Ещё раз: это проверка по документированным требованиям, а не прогон Rich Results
Test — до внешнего валидатора localhost не достучится.

---

## ЧАСТЬ D — Технические файлы

### D1. sitemap.xml

| Показатель | Значение |
| --- | --- |
| Отдаётся | 200, 61 448 байт |
| Всего `<url>` | **90** |
| Уникальных `<loc>` | 90 (дублей нет) |
| `xhtml:link` всего | 540 = 90 × 6 |
| hreflang в каждой записи | **есть**, 5 локалей + `x-default` |
| `lastmod` | есть у всех, значение `new Date()` на момент запроса — одинаковое для всех 90 записей, к реальным правкам контента не привязано |
| `changefreq`, `priority` | нет |

Состав:

| Тип | Записей |
| --- | --- |
| Главные | 5 |
| `/zhyvopys` | 5 |
| `/cycles` | 5 |
| `/pro-mene` | 5 |
| `/kontakty` | 5 |
| `/blog` | 5 |
| Страницы циклов (5 × 5) | 25 |
| Категории блога (3 × 5) | 15 |
| Статьи блога (4 × 5) | 20 |

Присутствуют все страницы, которые отдают 200. Отсутствуют отдельные URL картин —
их не существует: работа открывается параметром `?w=` на `/zhyvopys`, и в sitemap
таких адресов нет (`grep "w=" sitemap.xml` → 0). То есть 7 объектов с
Product-разметкой не имеют собственных индексируемых адресов.

### D2. image-sitemap.xml

| Показатель | Значение |
| --- | --- |
| Отдаётся | 200, 11 361 байт, `application/xml` |
| `<url>` | **20** |
| `<image:image>` | **20** (по одному на URL) |
| Уникальных изображений | 4 (обложки статей, повторённые по 5 локалям) |
| Что покрыто | только обложки статей блога |
| Что не покрыто | **все 7 картин**, 5 изображений циклов, портрет художника, 3 фото блока «Автентичність», обложка героя |

Содержимое (`app/image-sitemap.xml/route.js:11-28`): `image:title` собирается как
`` `${post.title} — блог Івана Куліка` ``. Заголовок статьи переведён, а хвост —
жёстко украинский во всех локалях:

```
<image:title>How to care for an oil painting — блог Івана Куліка</image:title>
<image:title>Jak dbać o obraz olejny — блог Івана Куліка</image:title>
<image:title>Wie man ein Ölgemälde pflegt — блог Івана Куліка</image:title>
```

`image:caption` = описание статьи, переведено корректно.
`image:license` и `image:geo_location` не используются.

### D3. robots.txt

```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: http://localhost:3000/sitemap.xml
Sitemap: http://localhost:3000/image-sitemap.xml
```

| Проверка | Результат |
| --- | --- |
| Отдаётся | 200, 148 байт |
| Ссылка на sitemap | **есть, обе** |
| Закрыто | `/admin`, `/api` |
| Не закрыто | `/uploads` (изображения из блоб-хранилища — открыты, что для картинок и нужно), `/og` |
| `Crawl-delay`, `Clean-param` | нет |

### D4. manifest (`/manifest.webmanifest`)

```json
{"name":"Iwan Kulik","short_name":"Kulik","description":"Oil painting",
 "start_url":"/","display":"standalone","background_color":"#ffffff",
 "theme_color":"#1a1a1a","icons":[{"src":"/icon-512.png","sizes":"512x512","type":"image/png"}]}
```

| Поле | Состояние |
| --- | --- |
| `name`, `short_name` | заполнены, только латиницей, не локализованы |
| `description` | «Oil painting» — 12 знаков, не локализовано |
| `start_url` | `/` — адрес, который отдаёт 307 |
| `icons` | одна иконка 512×512 (файл на месте, 200, реально 512×512); нет 192×192, нет `purpose: "maskable"` |
| `theme_color` / `background_color` | `#1a1a1a` / `#ffffff` — не совпадают ни с одной из двух тем сайта |
| `lang`, `dir`, `id`, `scope`, `screenshots`, `categories` | отсутствуют |

Файл отдаётся 200 (`manifest.webmanifest` есть в списке исключений `proxy.js`).

---

## ЧАСТЬ E — Изображения

Разбор по собранному HTML: извлечены все теги `<img>` с их атрибутами.

### E1. Наличие alt

| Страница | `<img>` | С alt | Без alt | С `alt=""` (декоративные) |
| --- | --- | --- | --- | --- |
| Главная | 15 | 15 | **0** | 3 (фото блока «Автентичність») |
| `/zhyvopys` | 7 | 7 | 0 | 0 |
| `/cycles` | 5 | 5 | 0 | 0 |
| `/cycles/[slug]` | 1 | 1 | 0 | 0 |
| `/pro-mene` | 1 | 1 | 0 | 0 |
| `/kontakty` | 0 | — | — | — |
| `/blog` | 4 | 4 | 0 | 0 |
| `/blog/[slug]` | 2 | 2 | 0 | 0 |
| `/blog/[кат.]` | 1 | 1 | 0 | 0 |
| 404 | 0 | — | — | — |

**Изображений без атрибута `alt` на сайте нет.**

### E2. Перевод alt по локалям

Сверено попарно uk ↔ en на пяти типах страниц. Alt переводится вместе с
контентом, единого языка для всех локалей нет:

| Изображение | uk | en |
| --- | --- | --- |
| Герой главной | «Олійний живопис» | «Oil Painting» |
| Картина `kulik-chess-01` | «Партія з котом» | «The Game with the Cat» |
| Картина `painting-battle-2` | «Батальна сцена, фрагмент» | «Battle scene, detail» |
| Цикл `cycle-master-margarita` | «Майстер і Маргарита» | «The Master and Margarita» |
| Портрет художника | «Іван Кулік» | «Iwan Kulik» |
| Обложка статьи | «Майстер і Маргарита: сімсот полотен одного роману» | «The Master and Margarita: seven hundred canvases from one novel» |
| Аватар автора | «Іван Кулік» | «Iwan Kulik» |

Оговорки по содержанию alt (сам факт наличия и перевода — в порядке):

- Alt всегда равен названию сущности. Отдельного поля alt в данных нет, поэтому
  описания кадра (что изображено, какая техника) alt не несёт.
- Герой главной: alt = «Олійний живопис» — это текст тагайна, который выведен
  видимо тут же на странице.
- 3 фото блока «Автентичність» помечены `alt=""` (подписание работы, мастерская,
  сертификат).
- Обложка статьи: alt повторяет заголовок статьи, стоящий рядом в `<h1>`.
- Аватар автора: alt = имя автора, которое стоит текстом справа от аватара.

### E3. sizes, priority, lazy

| Изображение | `sizes` | `loading` | `<link rel="preload" as="image">` |
| --- | --- | --- | --- |
| Герой главной | `100vw` | **не задан (eager)** | **есть** (`imageSrcSet` + `imageSizes=100vw`) |
| Карточки работ на главной | `(max-width: 560px) 100vw, (max-width: 920px) 50vw, 33vw` | lazy | — |
| Изображения циклов на главной | `(max-width: 920px) 100vw, 55vw` | lazy | — |
| Фото «Автентичність» | `(max-width: 1200px) 50vw, 360px` | lazy | — |
| Сетка `/zhyvopys` (7 шт.) | `(max-width: 720px) 50vw, 25vw` | **lazy у всех, preload нет** | — |
| Карточки `/cycles` | `(max-width: 920px) 100vw, 33vw` | lazy | — |
| Герой `/cycles/[slug]` | `(max-width: 920px) 100vw, 900px` | lazy | — |
| Портрет `/pro-mene` | `(max-width: 920px) 100vw, 470px` | lazy | — |
| Карточки `/blog` | `(max-width: 920px) 100vw, 33vw` | lazy | — |
| Обложка статьи | `760px` (фиксированный) | **lazy, preload нет** | — |
| Аватар автора | `40px` (в CSS элемент 32×32) | lazy | — |

- `sizes` задан у всех изображений без исключения.
- `priority` выставлен ровно в двух местах кода: герой главной
  (`page.js:41`) и активная картина в просмотрщике галереи
  (`Gallery.js:161`). Второе в исходной разметке не появляется — страница
  открывается в режиме сетки, просмотрщик рендерится только по клику.
- Атрибута `fetchpriority="high"` в HTML нет ни у одного изображения; у героя
  приоритет выражен только тегом `<link rel="preload">`. Единственное вхождение
  `fetchPriority="low"` в документе относится к служебному скрипту Next.
- Ни у одного `<img>` нет атрибутов `width`/`height` — все используют режим
  `fill` и размеры берут из CSS-контейнера с `aspect-ratio`.
- LCP-изображения `/zhyvopys` и `/blog/[slug]` помечены `loading="lazy"` и
  не предзагружаются.

---

## Список пропусков по важности

Только перечисление того, чего нет или что расходится с заявленным. Без указаний,
что с этим делать.

### Критично

1. **`og:image` и `twitter:image` не открываются на 70 из 90 страниц.**
   `/og/default.jpg` и `/og/zhyvopys.jpg` → 307 → 404. `og` отсутствует в списке
   исключений matcher'а `proxy.js:53`. Затронуты все страницы, кроме 20 страниц
   статей блога.

2. **На 404 нет `<title>`.** Ни title, ни description, ни canonical, ни
   `<html lang>`. Единственный тег — `robots: noindex`.

3. **`WebSite` + `SearchAction` отсутствует на всём сайте.** Ни одного узла
   `WebSite` в 91 проверенной странице.

4. **Два `Product` без `offers` / `review` / `aggregateRating`** — К-003 и К-004
   на `/zhyvopys` во всех пяти локалях. К-003 при этом имеет статус
   `available`.

5. **20 из 90 страниц имеют неуникальный description** — индекс блога и три его
   категории делят одну строку в каждой из пяти локалей.

### Существенно

6. **7 работ не имеют собственных URL** — ни в sitemap, ни как отдельные
   документы. `Offer.url` у всех семи ведёт на `?w=…`, canonical которого равен
   `/{loc}/zhyvopys`.

7. **В image-sitemap нет ни одной картины.** 20 записей — только обложки
   4 статей блога. Изображения работ, циклов, портрет художника и фото блока
   «Автентичність» не покрыты.

8. **`image:title` в image-sitemap частично не переведён**: хвост
   «— блог Івана Куліка» подставляется по-украински во все пять локалей.

9. **20 из 90 title не содержат имени художника** — все страницы статей блога.
   Категории блога в том же файле имя содержат.

10. **`og:image:width` / `og:image:height` = 1200×630 объявлены для всех
    страниц**, включая 20 страниц статей, где реальные файлы имеют
    1280×960, 900×630 и 900×756.

11. **`theme-color` отсутствует полностью**, а `theme_color` в манифесте
    (`#1a1a1a`) не совпадает ни с тёмной темой сайта (`#171614`), ни со светлой
    (`#FDFBF7`).

12. **`x-default` указывает на `/pl`, а корень сайта редиректит на `/en`**
    (`proxy.js:4`, `DEFAULT = "en"`). Редирект временный — 307, не 308.

13. **43 из 90 description короче 100 знаков**; в целевом коридоре 150–160
    находятся 3. Самые короткие — 32–41 знак на страницах циклов
    `critique-of-power` и `animal-farm`.

14. **LCP-изображения `/zhyvopys` и `/blog/[slug]` помечены `loading="lazy"`**
    и не предзагружаются. `priority` в проекте выставлен только у героя главной
    и у картины в просмотрщике галереи, который в исходной разметке отсутствует.

15. **У всех `ListItem` в `ItemList` нет `url` / `item`** — на `/zhyvopys`
    (7 из 7), `/blog` (4 из 4) и страницах категорий. Есть только `name` и
    `image`.

### Второстепенно

16. `Person` повторяется на 90 страницах без `@id` — 90 несвязанных узлов;
    `sameAs` объявлен пустым массивом, хотя ссылка на Instagram на сайте есть.
    Нет `image`. `url` ведёт на корень, который отдаёт 307.

17. `LocalBusiness` только на главной, без `url`, `telephone`, `priceRange`,
    `openingHoursSpecification`, `geo`, `streetAddress`, `postalCode`;
    `sameAs` пуст; `image` ведёт на `/og/default.jpg`, то есть на 404.
    Тип `LocalBusiness`, не `ArtGallery`.

18. `Article`: даты без времени и таймзоны (`2026-09-08`), `dateModified`
    равен `datePublished` у всех четырёх статей, `author` без `@id`,
    `publisher.logo` без размеров и с адресом, отдающим 404. Тип `Article`,
    не `BlogPosting`.

19. `Offer` без `priceValidUntil`, `itemCondition`, `hasMerchantReturnPolicy`
    и `shippingDetails` у всех пяти работ с ценой.

20. `og:locale` отдаётся как `uk`, `en`, `pl`, `de`, `ru` — без территории
    (`uk_UA`, `en_US`); то же в `og:locale:alternate`.

21. Нет `twitter:site`, `twitter:creator`, `twitter:image:alt` ни на одной
    странице. `og:image:alt` при этом есть.

22. У статей `og:type=article`, но нет ни одного свойства `article:*`
    (`published_time`, `modified_time`, `author`, `section`).

23. `og:image` страниц циклов, `/pro-mene` и категорий — общая `default.jpg`;
    собственные изображения этих страниц (фото цикла, портрет) в OG не
    подставляются.

24. 8 страниц имеют посимвольно одинаковые title в разных локалях: `Blog — Iwan
    Kulik` (en/pl/de), `Stańczyk — Iwan Kulik` (en/pl/de), `Kontakt — Iwan
    Kulik` (pl/de).

25. Два title длиннее 60 знаков: 63 (en) и 65 (de) у статьи
    `majster-i-margaryta-cykl`. Пять description длиннее 160: 161–167.

26. `lastmod` в sitemap — момент запроса, одинаковый у всех 90 записей;
    к датам изменения контента не привязан. `changefreq` и `priority` не заданы.

27. Манифест: `start_url: "/"` отдаёт 307; одна иконка 512×512 без варианта
    192×192 и без `purpose: "maskable"`; `description` — «Oil painting»;
    `name`, `short_name`, `description` не локализованы; нет `lang`, `id`,
    `scope`.

28. В `public/og/` остались `rozpys.jpg` и папка `rozpys/` от удалённого
    раздела `/rozpys` — ссылок на них в разметке нет.

29. Alt везде равен названию сущности; отдельного поля alt в данных нет.
    Alt героя дублирует видимый тагайн, alt обложки статьи — заголовок `<h1>`,
    alt аватара — имя автора, стоящее рядом текстом. 3 фото блока
    «Автентичність» отданы как декоративные (`alt=""`).

30. Аватар автора: `sizes="40px"` при CSS-размере 32×32. Обложка статьи:
    `sizes="760px"` фиксированный, без ветки для узких экранов.

31. Механизм сужения hreflang для частично переведённых статей
    (`getAvailableLocales`) в коде есть, но в текущих данных не задействован —
    все 4 статьи существуют во всех 5 локалях.

32. Ветка `availability: OutOfStock` в `lib/schema.js:135` в текущих данных
    не выдаётся ни разу: единственная работа со статусом `collection` не имеет
    цены и поэтому вовсе лишена `offers`.
