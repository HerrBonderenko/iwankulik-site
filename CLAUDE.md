# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack
- Next.js 16 (App Router), plain JavaScript — no TypeScript. `jsconfig.json` aliases `@/*` to `./*`.
- Package manager is npm; `package-lock.json` is committed — use `npm ci` for a clean, reproducible install (that is what Netlify does), `npm install` only when changing dependencies.
- ESLint is configured (`eslint-config-next/core-web-vitals`, flat config in `eslint.config.mjs`) — run `npm run lint`. Tests are vitest (`npm test`): `tests/unit` for pure functions, `tests/integration` against a real `next start` spawned by `tests/setup/global.mjs` into a temp `CONTENT_DIR`. No format tooling — verify formatting manually.

## Verifying

- `npm run lint` and `npm run build` are reliable locally: a green build means the routes and the page count are right.
- `npm test` needs a build first (`.next/`); the global setup builds one if it's missing. Every test exists to fail when a specific protection is removed — don't delete a red test, find out which protection broke. Integration tests read the audit log file directly because the spam guard deliberately answers `200 {ok:true}` to blocked bots — a status-code assertion alone would stay green on accepted spam.
- The hosting build command does NOT run tests (Netlify build command lives in its UI; `vercel.json` has no `buildCommand`) — only `.github/workflows/ci.yml` runs them. Keep that workflow alive.
- **`next start` on Windows is not a reliable model of production.** It gets `notFound()`, `not-found` boundaries and shell rendering wrong, so conclusions drawn from it about 404s have been wrong twice already. Verify anything in that area on a deploy, not locally.
- The concrete case: `notFound()` called inside a page renders an empty body locally — Next's own `<html id="__next_error__">` shell, bypassing the `(site)` layout — while on Netlify the same branch renders the full `app/not-found.js` 404 with header, footer and links in the page's locale. Comments in `cycles/[slug]/page.js` and `app/not-found.js` record this.
- The same caution applies to anything served through the Netlify runtime rather than rendered: ISR, prerender lookups, blob-backed reads.

## Structure
- Routes live in root-level `app/`, not `src/app`.
- `app/(site)/[locale]/...` — public, locale-prefixed pages. `app/(admin)/admin/...` — admin panel.
- Shared logic lives in `lib/` (`store.js`, `mail.js`, `adminAuth.js`, `auditLog.js`, `deviceTracking.js`, `rateLimit.js`, `formGuard.js`); content data in `data/site.js`; translations in `dictionaries/*.json`.
- Code comments are in Ukrainian; identifiers are in English — match this convention in existing files.

## Design
- Aesthetic is atmospheric and slow, not snappy — reference: samanthakeelysmith.com. This is about the character of the site, not about response times — see "Движение" below before picking any duration.
- `prefers-reduced-motion` fallback is mandatory on every animation/transition — provide a reduced/instant variant, don't just rely on `motion-reduce:` utility classes being remembered ad hoc. The single global block at the bottom of `app/globals.css` already kills `transform`, `animation` and `scroll-behavior`; don't add competing global blocks.

## Движение

Правило: если движение отвечает на действие человека — быстро.
Если происходит само — можно медленно.

| Что | Длительность | Токен |
|---|---|---|
| Отклик на действие: hover, active, открытие модалки, смена фильтра, переключение вида | 150–250ms | `--dur-fast`, `--dur-base` |
| Появление контента при загрузке: карточки галереи, секции | 400–600ms | отдельные значения |
| Декоративное движение без причины | не делаем | — |

«Slow, unhurried» в этом документе — про характер сайта: галерея, живопись,
ничего не мельтешит. Это не про миллисекунды отклика. Человек, нажавший
кнопку, ждёт ответа: дольше 300ms читается как лаг.

Кривая везде одна: `var(--ease)` = `cubic-bezier(.23, 1, .32, 1)`.
`ease-in` не используем — он замедляет начало, а отклик должен стартовать сразу.

## Storage (no database)
- `lib/store.js` picks a driver at runtime: Netlify Blobs (on Netlify builds), Vercel Blob (`BLOB_READ_WRITE_TOKEN` set), or local filesystem under `content/` (gitignored) as the dev fallback.
- Audit log, rate-limit counters, and known-device fingerprints all reuse this same driver, via `lib/auditLog.js`, `lib/rateLimit.js`, `lib/deviceTracking.js`.

## Uploads (`app/api/admin/upload/route.js`)
- 15 MB max; file type is verified by magic bytes, not filename or Content-Type.
- Every image is re-encoded with `sharp`: EXIF-rotate → resize to fit 2500x2500 → always converted to WebP (quality 85). Files that fail sharp decoding are rejected.
- `sharp` must stay listed in `next.config.mjs`'s `serverExternalPackages` and in `netlify.toml`'s `external_node_modules` — it's a native module and bundling will break it otherwise.

## Security / anti-spam
- Security headers are centralized in `next.config.mjs`'s `headers()`, not in `netlify.toml`.
- `lib/formGuard.js`'s `guardInquiry()` is the single entry point for honeypot + HMAC form-token + per-IP rate limiting on public inquiry forms.
- Admin login uses separate rate limiting (`lib/rateLimit.js`) and constant-time credential comparison against a dummy bcrypt hash to avoid timing leaks on unknown logins.
- Admin access checks go through `requireAdmin()` (`lib/adminAuth.js`) — never read `session.login` directly: `requireAdmin` also compares the session's `issuedAt` against the last-logout epoch, which is what makes logout actually revoke old cookies (iron-session is stateless, `destroy()` alone only clears the browser's copy).
- Mutating admin routes also call `isSameOrigin()` — compare against the `Host`/`x-forwarded-host` headers, not `new URL(request.url).host`: Next normalizes `request.url` and its host can differ from what the browser sent (a matching Origin got 403 that way once).

## Trust model — what input is trusted, and why

Do not relax these without re-reading the audit (`SECURITY_AUDIT_REPORT.md`):

- **Untrusted:** everything in requests to `/api/inquiry*`, `/api/admin/login`, `/api/form-token`; all path/query params; the `locale` cookie; all client-supplied headers. Any field a route reads from an inquiry body must be listed in `LENGTH_LIMITS` (`lib/formGuard.js`) — a field outside that list is bounded only by the 64 KB body cap and goes into the mail subject and audit log as-is.
- **Client IP is trusted only from `TRUSTED_IP_HEADER`** (`lib/rateLimit.js`): the one header the current platform's proxy provably sets. Probing several headers in order is how the spoofing hole worked — a header the platform doesn't set arrives exactly as the client sent it. On an unrecognized platform the limiter turns itself off and says so loudly in the server log; that state means brute-force protection is OFF.
- **Semi-trusted (admin-written, still validated):** the site data blob. It reaches `href`s, file-read paths and server-side fetch targets, so `validateSiteData` (`lib/siteData.mjs`) checks `contacts.instagram` is http(s), and `lib/safeUrl.js` whitelists scheme+host for anything that becomes a mail link or an OG-background fetch. React blocking `javascript:` and browsers blocking `data:` navigation are the layers behind it — don't make them the only ones.
- **Trusted:** `blog-content/*.mdx` — git-committed, owner-written. `blockJS: false` in `lib/blog.js` relies on exactly this: MDX evaluates JS expressions server-side. **If articles ever start arriving from outside git (CMS, author form, import), remove `blockJS: false` first.**

## Env vars
Required beyond `.env.example`'s `NEXT_PUBLIC_SITE_URL`: `SESSION_SECRET`, `ADMIN_USERS` (JSON array of `{login, name, hash}`), `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`, `MAIL_TO_INQUIRY`, and optionally `BLOB_READ_WRITE_TOKEN`. `NETLIFY` / `IS_NETLIFY_BUILD` are set automatically by Netlify builds — don't set them manually.

Optional: `TRUSTED_IP_HEADER` — only for self-hosting behind a known proxy: the header that proxy provably overwrites with the client address (see Trust model). `CONTENT_DIR` — moves the fs-driver storage root away from `content/`; used by tests, no effect on Netlify/Vercel.

`SESSION_SECRET` is double-duty: iron-session encryption AND the HMAC key for form tokens (`lib/formGuard.js`). Keep it set and ≥32 chars on every deploy target.

In `.env.local`, escape every `$` in `ADMIN_USERS`'s bcrypt hashes as `\$` (e.g. `\$2b\$12\$...`) — `@next/env`'s `dotenv-expand` step treats unescaped `$word` as variable interpolation and silently mangles the hash otherwise. Not needed on prod (Netlify/Vercel inject `ADMIN_USERS` directly into `process.env`, bypassing dotenv parsing).

## Deployment / git
Dual-target deploy: Netlify (`netlify.toml`) and Vercel (`vercel.json`). CI is `.github/workflows/ci.yml` (lint → build → test → `npm audit --audit-level=high`) — deploys do NOT wait for it, so a red CI is a signal to act on, not a blocked deploy. Dependency updates: `.github/dependabot.yml`; note Dependabot alerts stay silent until "Dependency graph" + "Dependabot alerts" are enabled once in the repo's Settings → Code security. History is linear on `main` only, with short imperative commit messages (no conventional-commit prefixes).
