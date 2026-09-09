# AUDIT-UI-GUIDELINES

Аудит публичной части по скиллу `web-design-guidelines`
(`C:\Users\Admin\.claude\skills\web-design-guidelines\SKILL.md`).

Скилл — тонкая обёртка: он предписывает загрузить свежие правила с
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
и прогнать по ним файлы. Правила загружены и применены полностью.

**Отступление от формата скилла.** Скилл требует группировать находки по файлам.
Общие правила задания требуют сортировки по важности. Приоритет отдан заданию:
разделы — уровни важности, внутри каждого — `путь:строка`.

Область: `app/(site)/`, `components/`, `app/globals.css`, `lib/`.
Админка (`app/(admin)/`) не проверялась. Правки не вносились.
Часть выводов подтверждена запросом к работающему dev-серверу (`GET /uk`).

Всего находок: **46**.

---

## Блокеры (7)

### 1. На главной нет `<h1>`
`app/(site)/[locale]/page.js:34-56`

Проверено на живой странице: первый заголовок в разметке — `<h2 class="works-title">Живопис`.
Имя художника и тагайн в герое отданы `<span class="hero-name">` / `<span class="hero-tagline">`
(строки 43-44 и 52-53).

Почему важно: главная страница сайта художника не объявляет свою тему ни скринридеру
(навигация по заголовкам начинается со второго уровня и «повисает»), ни поисковику.
Правило гайдлайнов: «Headings hierarchical `<h1>`–`<h6>`». Остальные страницы h1 имеют
(`zhyvopys/page.js:55`, `cycles/page.js:43`, `pro-mene/page.js:58`, `blog/page.js:52`,
`blog/[slug]/page.js:189`, `NotFoundPage.js:44`) — выбивается ровно главная.

### 2. Нет skip-link, `<main>` без якоря
`app/(site)/[locale]/layout.js:83`

`<main>{children}</main>` — без `id`, во всём проекте нет ссылки «к содержимому»
(проверено grep'ом).

Почему важно: чтобы дойти с клавиатуры до контента на любой странице, нужно пройти
логотип, 5 пунктов навигации, телефон, кнопку CTA, 5 переключателей языка и кнопку темы —
около 14 табов, и так на каждой странице. Правило: «include skip link for main content».

### 3. Модалка заявки не является диалогом
`components/InquiryModal.js:26-52`

Нет `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Фокус не переносится внутрь
при открытии и не возвращается на кнопку-триггер при закрытии. Ловушки фокуса нет —
Tab из формы уходит на страницу под подложкой. Нет `overscroll-behavior: contain`
(`app/globals.css:619-629`).

Есть верно: закрытие по Escape (строка 9), блокировка прокрутки тела (строка 11),
`aria-label` на крестике (строка 29), `stopPropagation` на панели (строка 28).

Почему важно: пользователь скринридера после открытия модалки остаётся в контексте
страницы под ней и не узнаёт, что диалог открылся; клавиатурный пользователь уходит
табом в невидимый контент.

### 4. Мобильное меню — не диалог и не блокирует фон
`components/Header.js:122, 125-160`

Бургер (строка 122) без `aria-expanded` и `aria-controls`. Панель (строка 129) — обычный
`<div>` без `role="dialog"`. Фокус не переносится на панель, ловушки нет.
Прокрутка фона не блокируется — в отличие от `InquiryModal.js:11`, где это сделано.

Почему важно: на ширине ≤1080px (`app/globals.css:309-313`) это единственная навигация
сайта. Скролл фона под полноэкранной непрозрачной панелью — это ещё и видимый баг:
страница уезжает, а меню стоит.

### 5. Стрелки клавиатуры в галерее перехватываются всегда
`components/Gallery.js:73-80`

`useEffect` с `window.addEventListener("keydown", ...)` стоит до раннего возврата
`if (thumbs)` (строка 82), то есть слушатель активен во всех режимах. Нет проверки
`e.target`, нет проверки открытой модалки (`ask`).

Почему важно: ←/→ в поле поиска по номеру в футере (`WorkCodeSearch.js:46`) или в
`<textarea>` открытой модалки молча листают картину под ней. Это не гипотетика —
поиск в футере есть на каждой странице, включая `/zhyvopys`.

### 6. Кольцо фокуса в полях формы слабее браузерного
`app/globals.css:640` и `app/globals.css:597`

```
.form input:focus, .form textarea:focus { outline: 1px solid var(--border-strong); }
.footer-search input:focus { outline: 1px solid var(--border-strong); }
```

В тёмной теме `--border-strong` = `rgba(239, 235, 228, 0.18)` (`globals.css:51`) —
контраст к `--bg` около 1.3:1. Дефолтное кольцо браузера заменено на почти невидимое.
Плюс использован `:focus`, а не `:focus-visible` — кольцо появляется и по клику мышью.

Правила: «Never `outline: none` without focus replacement» (формально outline есть,
но замена хуже оригинала) и «Use `:focus-visible` over `:focus`».

### 7. Нет единого стиля `:focus-visible`
`app/globals.css` — во всём файле ровно одно правило: `.sound-btn:focus-visible` (строка 742)

Все остальные интерактивные элементы полагаются на дефолт браузера. При этом
`button { background: none; border: none }` (строка 134) снимает у кнопок фон и рамку,
а в тёмной теме дефолтное кольцо Chrome рисуется тёмным — на `--bg: #171614` оно
теряется. Затронуты: `.btn-hero`, `.header-cta`, `.works-filter`, `.thumb-act`,
`.viewer-nums button`, `.modal-close`, `.burger`, `.theme-btn`, `.scroll-top`,
`.footer-search button`, `.langs a`, `.thumb`.

---

## Высокая важность (14)

### 8. Тач-зоны заметно меньше 44px
`app/globals.css` — расчёт по padding + font-size + line-height:

| Элемент | Строка | Примерная высота | Роль |
| --- | --- | --- | --- |
| `.burger` | 293 | ~24px (текст 14px, padding 0) | единственный вход в мобильную навигацию |
| `.langs a` | 290-292 | ~20×20px, gap 8px | 5 целей подряд, десктоп и меню |
| `.mobile-menu .langs a` | 327 | padding обнулён → ~22px | то же в мобильном меню |
| `.viewer-nums button` | 548 | ~17px, без padding | десятки целей подряд |
| `.modal-close` | 630 | ~20px | закрытие модалки |
| `.theme-btn` | 265-273 | ~25px (padding 6px, line-height 1) | |
| `.mobile-actions .theme-btn` | 288 | ~27px | |
| `.works-filter` | 1251-1263 | ~30px | |
| `.footer-search input`/`button` | 589-604 | ~28-32px | |
| `.thumb-act` | 559 | текст 13px, без padding | «Придбати» в каждой карточке |
| `.header-phone` | 230-240 | ~32px | |

Хорошо: `.scroll-top` 44×44 (строки 697-698), `.btn-hero` padding 18/34 (строка 394),
`.mobile-menu a` padding 10px 0 (строка 323).

Почему важно: `.burger` и `.langs a` — самые частые мобильные цели на сайте, и они же
самые мелкие. `.viewer-nums` — ряд из десятков 17-пиксельных целей вплотную.

### 9. Автовоспроизводимое видео без паузы и без реакции на reduced-motion
`app/(site)/[locale]/page.js:37`, `components/ProcessVideo.js:25`

Оба `<video autoPlay muted loop playsInline>`. У процесс-видео есть кнопка звука
(`ProcessVideo.js:27`), но не паузы. У героя нет ничего. `prefers-reduced-motion`
не проверяется ни в JS, ни в CSS (`globals.css:724-728` и `1647-1655` гасят только
transition/animation, к `<video>` это не относится).

Правила гайдлайнов, оба нарушены: «Autoplay motion >5 seconds alongside other content
needs pause, stop, or hide controls» и «Muted decorative loops must stop under
`prefers-reduced-motion`».

### 10. Ошибки формы не привязаны к полям
`components/OrderForm.js:101-118`

Один общий `<span class="form-note">` в конце формы. Нет `aria-live`, нет `aria-invalid`
на полях, фокус не переносится на первое ошибочное поле, сообщение не стоит рядом с ним.

Правило: «Errors inline next to fields; focus first error on submit».

Почему важно: при `invalid_email` пользователь получает текст «Некоректний email» внизу
формы, а курсор остаётся там, где был. Скринридер не узнаёт об изменении вовсе.

### 11. Успешная отправка не объявляется и роняет фокус
`components/OrderForm.js:69-76`

При `status === "sent"` форма целиком заменяется на `<p>{t.form.sent}</p>`.
Нет `role="status"` / `aria-live="polite"`.

Почему важно: элемент, на котором стоял фокус (кнопка отправки), удаляется из DOM —
фокус падает на `<body>`. Скринридер молчит: человек не знает, что заявка ушла.
Правило: «Async updates (toasts, validation) need `aria-live="polite"`».

### 12. Поля формы без автозаполнения и с неверными типами
`components/OrderForm.js:83-92`

```
<input name="name" required maxLength={100} />                      // нет autocomplete="name"
<input name="email" type="email" ... />                             // нет autocomplete="email", нет spellCheck={false}
<input name="phone" inputMode="tel" ... />                          // нет type="tel", нет autocomplete="tel"
<textarea name="comment" ... />                                     // ок
```

Правила: «Inputs need `autocomplete` and meaningful `name`», «Use correct `type`
(`email`, `tel`, ...) and `inputmode`», «Disable spellcheck on emails».

Почему важно: форма заявки — единственный канал продажи на сайте. Без autocomplete
на телефоне каждое поле набирается руками.

### 13. Кнопка отправки: нет состояния «отправляю»
`components/OrderForm.js:99`

`disabled={status === "sending"}`, но подпись остаётся «Надіслати запит», спиннера нет,
и `:disabled` во всём `globals.css` не стилизован (проверено grep'ом — ноль вхождений).

Почему важно: кнопка визуально не меняется вообще. Правила: «spinner during request»
и «Loading states end with `…`».

### 14. `aria-label` переключателя темы перекрывает видимую подпись
`components/ThemeToggle.js:44`

`aria-label={t.theme}` = «Тема», при этом видимый текст кнопки — «Світла» или «Темна»
(строки 48, 52). Доступное имя не содержит видимого текста.

Почему важно: WCAG 2.5.3 «Label in Name» — пользователь голосового управления скажет
«нажми Світла» и не попадёт. Плюс нет `aria-pressed` — состояние переключателя
не передаётся вовсе.

### 15. Группа фильтров работ не сообщает активный вариант
`components/WorksSection.js:69-85`

Активность выражена только классом `is-active` → цветом (`globals.css:1267-1270`).
Нет `aria-pressed`, нет обёртки `role="group"` с именем.

Почему важно: скринридер читает пять одинаковых кнопок и не может сказать, какая
выбрана. Тот же дефект в галерее.

### 16. Кнопки-номера в просмотрщике без имён
`components/Gallery.js:190-194`

`<button className={k === i ? "active" : ""}>{k + 1}</button>` — доступное имя «7»,
без указания на суть и без `aria-current`.

Почему важно: озвучивается «кнопка 7» без контекста; активный номер отличается
только цветом (`globals.css:549`).

### 17. Мёртвая кнопка в блоке «Автентичність»
`components/AuthenticitySection.js:44`

Когда скан сертификата не залит, рендерится `<button type="button" class="btn-secondary">`
без обработчика — фокусируемый элемент, который объявляется кнопкой и ничего не делает.
Комментарий выше (строки 35-37) подтверждает, что это осознанная заглушка.

Правило: «Handle empty states — don't render broken UI».

### 18. Нет `color-scheme` для тёмной темы
`app/globals.css:27` (блок `[data-theme="dark"]`)

Свойство `color-scheme` не объявлено нигде в файле (проверено grep'ом).

Почему важно: нативные скроллбары, поля ввода и выпадашки остаются светлыми на тёмном
фоне. Правило: «`color-scheme: dark` on `<html>` for dark themes (fixes scrollbar, inputs)».
Сайт по умолчанию тёмный (`layout.js:67`), так что это состояние по умолчанию.

### 19. `theme-color` отсутствует и расходится с манифестом
`app/manifest.js:9`, `app/(site)/[locale]/layout.js`

`<meta name="theme-color">` не выводится (проверено на живой странице — тега нет;
экспорта `viewport` в проекте нет). В манифесте `theme_color: "#1a1a1a"` и
`background_color: "#ffffff"` — не совпадают ни с `--bg` тёмной темы (`#171614`),
ни со светлой (`#FDFBF7`).

Правило: «`<meta name="theme-color">` matches page background».

### 20. Состояние фильтра не отражается в URL
`components/WorksSection.js:27, 40-43`

`const [filter, setFilter] = useState("all")`.

Почему важно: нельзя дать ссылку на «Живопис, цикл Дон Кіхот», кнопка «назад» фильтр
не восстанавливает, обновление страницы сбрасывает выбор. Правило: «URL reflects state —
filters, tabs, pagination». Соседняя галерея делает это верно (`?w=`,
`Gallery.js:62-71, 94-103`) — расхождение внутри одного сайта.

### 21. Пустой каталог роняет просмотрщик
`components/Gallery.js:32-35, 82, 140-142, 161`

При `paintings = []`: `n = 0`, `p = paintings[0]` = `undefined`. Начальный рендер
безопасен (`thumbs = true`), но кнопка «показати по одній» (строка 141) переключает
в ветку просмотрщика, где `p.img` (строка 161) бросает исключение. `go()` при `n === 0`
даёт `NaN`.

Правило: «Handle empty states — don't render broken UI for empty strings/arrays».

---

## Средняя важность (17)

### 22. Alt-тексты

- `app/(site)/[locale]/page.js:41` — alt героя = `t.hero.tagline` («Олійний живопис»),
  тот же текст выведен рядом видимо (строка 44/53). Alt дублирует контент и не описывает
  фотографию.
- `components/AuthenticitySection.js:60` — `alt=""` у трёх содержательных фото:
  подписание работы, мастерская, сертификат. Ключевой блок доверия остаётся пустым
  для скринридера; `photoNote` (строка 69) описывает не каждый кадр, а идею.
- `components/blog/BlogMeta.js:11` — аватар с `alt={pick(author.name, locale)}`,
  имя автора стоит текстом сразу справа (строка 13) → двойное озвучивание.
  Здесь как раз уместен `alt=""`.
- `app/(site)/[locale]/blog/[slug]/page.js:200` — обложка с `alt={post.title}`,
  тот же текст в `<h1>` строкой выше (строка 189).

**Перевод alt на 5 локалей:** там, где alt содержательный, он берётся из
`pick(title, locale)` — то есть переведён вместе с названием работы или цикла
(`Gallery.js:105,161`, `WorksSection.js:110`, `CyclesSection.js:58`, `cycles/page.js:54`,
`cycles/[slug]/page.js:82`). Это верно. Отдельных полей alt в данных нет — то есть
alt всегда равен названию и не может описать сам кадр.

### 23. Отсутствуют базовые свойства тач-взаимодействия
`app/globals.css` — во всём файле нет ни одного вхождения (проверено grep'ом):

- `touch-action: manipulation` — задержка 300мс на двойной тап остаётся;
- `-webkit-tap-highlight-color` — синяя подсветка iOS по умолчанию, поверх тёмной темы;
- `overscroll-behavior: contain` — на `.modal` (строка 624, `overflow: auto`) и
  `.mobile-menu` (строка 314): прокрутка «протекает» на страницу под ними.

### 24. Safe-area не учтена в мобильном меню
`app/globals.css:314-320`

`.mobile-menu { position: fixed; inset: 0; padding: 24px 20px; }` — без
`env(safe-area-inset-*)`. Верхний ряд с логотипом и кнопкой «Закрити» уходит под
чёлку/статус-бар.

Единственное место, где safe-area учтена, — `.hero-text` (строка 443). Правило:
«Full-bleed layouts need `env(safe-area-inset-*)`».

### 25. Поле поиска по номеру: нет `name`, нет `type="search"`
`components/WorkCodeSearch.js:46-55`

Есть верно: `aria-label` (50), `autoComplete="off"` (52), `spellCheck="false"` (53),
`enterKeyHint="search"` (54), `role="status"` на сообщении (58). Нет `name` — правило
требует осмысленный `name` даже у неотправляемых форм; нет `type="search"`
(на мобильных даёт крестик очистки).

### 26. Цены форматируются вручную вместо `Intl.NumberFormat`
`lib/price.js:19-37`

Группировка разрядов и позиция знака € собраны регулярками и `if (locale === "en")`.

Правило прямо перечисляет это в анти-паттернах: «Hardcoded date/number formats
(use `Intl.*`)». Даты сделаны верно — `lib/blog.js:147-152` использует
`Intl.DateTimeFormat` ✓.

Замечу: комментарий в файле объясняет решение (валюта не хранится в данных). Но
`Intl.NumberFormat(locale, {style:"currency", currency:"EUR"})` покрывает ровно этот
случай, включая nbsp и порядок для de/pl/uk/ru.

### 27. Заголовки карточек — не заголовки
`components/blog/BlogCard.js:12` — `<span class="card-caption blog-card-title">`
`app/(site)/[locale]/cycles/page.js:57` — `<span class="cycle-card-title">`

При этом на главной названия циклов — `<h3>` (`CyclesSection.js:74`). Внутри одного
сайта одна и та же сущность то заголовок, то нет: навигация по заголовкам в списке
статей и в списке циклов не работает.

### 28. Секция циклов на главной без собственного заголовка
`components/CyclesSection.js:27-31`

`<section id="cycles">` открывается `<p class="cycles-intro">`, дальше сразу `<h3>`
названий циклов. Формально уровни не пропущены (перед этим идёт `<h2>` секции работ),
но пять h3 оказываются вложены в раздел «Живопис» — дерево заголовков описывает
не ту структуру, что видит глаз. При этом на этот якорь ведёт пункт меню
«Цикли» (`Header.js:47`).

### 29. Две соседние ссылки на один адрес с одинаковым именем
`components/CyclesSection.js:46-61` и `:75`

Картинка — `<Link aria-label={title}>`, название — `<Link>{title}</Link>`, обе на
`/cycles/${slug}`. Скринридер объявляет два одинаковых пункта подряд, для каждого
из пяти циклов.

### 30. Переключатель языка: нет семантики и `hreflang`
`components/Header.js:84-98`

`<span class="langs">` с пятью `<a>`. Есть `lang={l}` ✓ (строка 92). Нет: обёртки
`<nav aria-label="…">`, атрибута `hreflang`, `aria-current` на активном (активность
передана только цветом — `globals.css:291-292`).

### 31. Обложка статьи: фиксированный `sizes`
`app/(site)/[locale]/blog/[slug]/page.js:200`

`sizes="760px"` — но контейнер `.blog-article` (`globals.css:1521`) это `max-width: 760px`,
то есть на телефоне 390px качается изображение под 760px. Должно быть
`(max-width: 800px) 100vw, 760px`, как сделано в `Gallery.js:161`.

### 32. Аватар автора: `sizes` больше отрисованного размера
`components/blog/BlogMeta.js:11` — `sizes="40px"`, CSS даёт 32×32
(`globals.css:1536-1537`).

### 33. Нет `preconnect` к домену изображений
`app/(site)/[locale]/layout.js:66-68`

Все изображения приходят с `**.public.blob.vercel-storage.com`
(`next.config.mjs:3-5`). `<link rel="preconnect">` не выставлен.

Правило: «Add `<link rel="preconnect">` for CDN/asset domains».

Шрифты сделаны верно — `next/font` с `display: "swap"` (`layout.js:19-32`),
самохостинг и preload берёт на себя Next ✓.

### 34. Вес DOM страницы галереи растёт линейно
`app/(site)/[locale]/zhyvopys/page.js:51-53`, `components/Gallery.js:86, 191`

На страницу выводится: один `<script type="application/ld+json">` на каждую картину,
плюс `<figure>` на каждую, плюс одна кнопка-номер на каждую. Виртуализации нет.

Правило: «Large lists (>50 items): virtualize (`content-visibility: auto`)».
Сейчас каталог небольшой — находка условная, но заявленный масштаб («понад 4 000
полотен», `dictionaries/uk.json:45`) делает её вопросом времени.

### 35. Типографика: неразрывные пробелы

`formatPrice` (`lib/price.js:11, 36`) использует NBSP верно ✓. Остальные числовые
пары — обычным пробелом:

- `components/Gallery.js:126` и `:172` — `{x.size} см`
- `components/WorksSection.js:124` — `{p.size} см`
- `components/CyclesSection.js:82`, `cycles/page.js:60`, `cycles/[slug]/page.js:75`
  — `{c.count} {t.cycles.canvases}`
- `components/blog/BlogMeta.js:22`, `components/blog/BlogCard.js:19`
  — `{readingMinutes} {t.blog.minRead}`

### 36. Типографика: прямые кавычки в трёх словарях
`dictionaries/en.json`, `dictionaries/pl.json`, `dictionaries/de.json` — ключ
`form.paintingPrefill`:

- en: `"{title}"` — прямые кавычки вместо `“{title}”`
- pl: `„{title}"` — открывающая нижняя, закрывающая прямая; должно быть `„{title}”`
- de: `„{title}"` — то же; должно быть `„{title}“`

uk и ru используют `«{title}»` ✓ верно.

Текст подставляется в поле комментария заявки (`InquiryModal.js:25`), то есть уезжает
в письмо клиенту и художнику.

Многоточий `...` вместо `…` в словарях нет ✓ (проверено скриптом по всем пяти).

### 37. Нет `text-wrap: balance` на заголовках
`app/globals.css:101-113`

`text-wrap: pretty` стоит на абзацах (строки 852, 963, 1090, 1152, 1441) ✓,
на заголовках — ничего. При пяти локалях длина заголовков гуляет сильно
(`.works-title` 56px, `.cycle-title` 64/88px, `.fact-num` 56px), висячие строки
вероятны.

### 38. Нет `tabular-nums`
`app/globals.css` — ни одного вхождения.

Кандидаты: `.fact-num` (1482), `.works-card-price` (1341), `.viewer-nums` (548),
`.step-num` (492), `.works-range` (1272). Правило: «`font-variant-numeric: tabular-nums`
for number columns/comparisons».

---

## Низкая важность (8)

### 39. `translate="no"` не проставлен
Инвентарные номера `К-001` (`globals.css:568`, `Gallery.js:118,165`,
`InquiryModal.js:37`), адрес почты, слово «Instagram». Автоперевод браузера может
их исказить — а номер из сертификата обязан совпадать посимвольно.

### 40. Ссылки в новую вкладку без предупреждения
`components/Footer.js:10`, `components/Header.js:153`,
`app/(site)/[locale]/kontakty/page.js:49`, `components/AuthenticitySection.js:40`.
`rel="noopener noreferrer"` проставлен везде ✓, но открытие в новом окне
нигде не обозначено.

### 41. Счётчик работ не согласован с фильтром
`components/WorksSection.js:133`

`{shown: shown.length, total: paintings.length}` — `shown` после фильтра,
`total` всегда весь каталог. С выбранным циклом получается «6 з 40 робіт»,
где 40 к текущему списку отношения не имеет.

### 42. Диапазон цен не реагирует на фильтр
`components/WorksSection.js:45-54, 88-94`

`range` считается по всем доступным работам и стоит вплотную к кнопкам фильтров
(`.works-head-right`, `globals.css:1242-1247`) — читается как диапазон выбранного цикла.

### 43. Видео без субтитров и транскрипта
`app/(site)/[locale]/page.js:37`, `components/ProcessVideo.js:25` — нет `<track>`.
У процесс-видео есть звуковая дорожка (`hasSound`, `page.js:81`), то есть это
содержательное медиа. Правило: «Meaningful media needs captions, transcripts,
or descriptions as applicable».

### 44. Плейсхолдер поиска без многоточия
`dictionaries/*.json` → `search.placeholder: "К-001"`.

Правило: «Placeholders end with `…` and show example pattern». Образец формата здесь
как раз показан ✓, многоточия нет. Замечу отдельно: буква «К» кириллическая во всех
пяти локалях, но `lib/workCodes.js:109` принимает и латинскую `K` ✓ — так что для
en/pl/de ввод не ломается.

### 45. Нет предупреждения о несохранённом вводе
`components/OrderForm.js` — уход со страницы с заполненной формой ничем не
сопровождается. Правило есть в гайдлайнах; для формы из четырёх полей приоритет низкий.

### 46. `title` дублирует `aria-label`
`components/ThemeToggle.js:44`, `components/ScrollTop.js:23`,
`components/WorkCodeSearch.js:51` — `title` и `aria-label` с одинаковым значением.
Безвредно, но `title` не показывается на тачскринах и создаёт лишний узел
в дереве доступности.

---

## Проверено — замечаний нет

- **`transition: all`** — ни одного вхождения в `globals.css` (grep). Все переходы
  перечисляют свойства явно.
- **`<div onClick>` вместо кнопок** — не найдено. Действия на `<button>`, навигация
  на `<Link>`/`<a>`. Особо: `Gallery.js:94-103` — миниатюра сделана `<Link>` с
  перехватом левого клика, средний клик и Ctrl+клик работают; `Header.js:79-82` —
  `onPointerDown` для обновления суффикса перед контекстным меню.
- **`user-scalable=no` / `maximum-scale=1`** — нет; viewport на живой странице
  `width=device-width, initial-scale=1` ✓.
- **Блокировка вставки (`onPaste` + `preventDefault`)** — не найдено.
- **`autoFocus`** — не используется нигде ✓.
- **Лейблы форм** — `OrderForm.js:83-92`: `<label>` оборачивает `<input>`,
  вся строка кликабельна ✓. Ханипот скрыт стилями, а не атрибутом, с `tabIndex={-1}`
  и `aria-hidden` (`OrderForm.js:96`) ✓ — сделано правильно.
- **CLS от изображений** — везде `next/image` с `fill` внутри контейнера с
  `aspect-ratio`; в `WorksSection.js:109` пропорция вычисляется из размера холста
  (`aspectFromSize`, строки 17-24), то есть высота известна до загрузки файла ✓.
  `.auth-photo` получает явные width/height (`AuthenticitySection.js:55`) ✓.
- **`priority` / lazy** — `priority` на герое (`page.js:41`) и на активной картине
  в просмотрщике (`Gallery.js:161`); остальное лениво по умолчанию Next ✓.
- **Декоративные иконки** — `aria-hidden="true"` на SVG телефона (`Header.js:110`),
  на иконках темы (`ThemeToggle.js:19,29`), на точке бейджа (`Gallery.js:110`,
  `WorksSection.js:113`), на эмодзи звука (`ProcessVideo.js:28`), на «404»
  (`NotFoundPage.js:43`) ✓.
- **Иконочные кнопки** — `.modal-close` (`InquiryModal.js:29`) и `.scroll-top`
  (`ScrollTop.js:22`) имеют `aria-label` ✓.
- **`aria-pressed`** — есть на кнопке звука (`ProcessVideo.js:27`) ✓.
- **`role="status"`** — есть на сообщении поиска по номеру (`WorkCodeSearch.js:58`) ✓.
- **Даты** — `Intl.DateTimeFormat` (`lib/blog.js:149`), в разметке `<time dateTime>`
  (`BlogMeta.js:17,19`) ✓.
- **Гидратация** — `layout.js:67-80` (тема ставится до первой отрисовки +
  `suppressHydrationWarning`), `NotFoundPage.js:25` (`useSyncExternalStore` вместо
  `setState` в эффекте), `Header.js:19-34` (суффикс адреса читается после гидратации) —
  все три места решены аккуратно и прокомментированы ✓.
- **`scroll-margin-top` для якорей** — `html { scroll-padding-top: 85px }`
  (`globals.css:90`) и `.gallery-box { scroll-margin-top: 88px }` (583) ✓,
  липкая шапка цель не накрывает.
- **Переполнение текста** — `.work-line` с `flex-wrap` и `min-width: 0`
  (`globals.css:577-579`) обрабатывает длинные названия рядом с номером ✓.
- **Пустые состояния блога** — `blog/page.js:65-67` и `blog/[slug]/page.js:137-139`
  выводят `t.blog.noPosts` ✓. Циклы без фото — плейсхолдер `.cycle-img-empty` ✓
  (`CyclesSection.js:59`). Цикл без количества полотен — строка не рендерится вовсе
  (`CyclesSection.js:41`) ✓.
- **Полнота словарей** — сверены все пять по плоскому списку ключей: расхождений нет ✓.
- **Порядок табуляции** — совпадает с визуальным порядком в шапке, мобильном меню
  и формах; ловушек нет (кроме отсутствия переноса фокуса в оверлеи, п. 3-4).
- **Управляемые поля** — `WorkCodeSearch.js:47-48` `value` + `onChange` ✓;
  `OrderForm` использует неуправляемые поля с `defaultValue` ✓, что и рекомендуют
  гайдлайны.

---

## Что из скилла неприменимо

- **Виртуализация списков** — правило есть, но текущие объёмы данных до порога
  в 50 элементов не доходят. Оставлено как условная находка (п. 34).
- **Нативный `<select>`** — на публичной части нет ни одного, правило
  про Windows dark mode не применимо.
- **Определение языка по `Accept-Language`** — на сайте язык всегда в URL, выбор
  запоминается cookie (`Header.js:9-14`). Правило про IP-детект не нарушено.
- **Drag/swipe с клавиатурной альтернативой** — свайп в просмотрщике
  (`Gallery.js:152-158`) дублирован кнопками «попер./наст.» (`Gallery.js:187-188`)
  и стрелками ✓, требование выполнено.
- **Заголовки в Title Case, «8 deployments» вместо «eight»** — правила раздела
  «Content & Copy» написаны под англоязычный продукт. Сайт пятиязычный, с
  украинским как основным; в славянских языках Title Case не применяется.
  Раздел пропущен осознанно, кроме проверки типографики (п. 35-36).
