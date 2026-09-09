# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack
- Next.js 16 (App Router), plain JavaScript — no TypeScript. `jsconfig.json` aliases `@/*` to `./*`.
- Package manager is npm; no lockfile is committed, so `npm install` regenerates one.
- ESLint is configured (`eslint-config-next/core-web-vitals`, flat config in `eslint.config.mjs`) — run `npm run lint`. No format or test tooling is configured — verify those manually.
- `README.md` is stale (says "Next.js 15") — trust `package.json`/the installed version instead.

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

## Env vars
Required beyond `.env.example`'s `NEXT_PUBLIC_SITE_URL`: `SESSION_SECRET`, `ADMIN_USERS` (JSON array of `{login, name, hash}`), `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`, `MAIL_TO_INQUIRY`, and optionally `BLOB_READ_WRITE_TOKEN`. `NETLIFY` / `IS_NETLIFY_BUILD` are set automatically by Netlify builds — don't set them manually.

In `.env.local`, escape every `$` in `ADMIN_USERS`'s bcrypt hashes as `\$` (e.g. `\$2b\$12\$...`) — `@next/env`'s `dotenv-expand` step treats unescaped `$word` as variable interpolation and silently mangles the hash otherwise. Not needed on prod (Netlify/Vercel inject `ADMIN_USERS` directly into `process.env`, bypassing dotenv parsing).

## Deployment / git
Dual-target deploy: Netlify (`netlify.toml`) and Vercel (`vercel.json`). No CI is configured. History is linear on `main` only, with short imperative commit messages (no conventional-commit prefixes).
