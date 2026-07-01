# v1 API — agent-feedback fixes (media validation, CSRF, docs)

Four items from an agent that bulk-used the `/api/v1` write API.

## Item 1 — BUG: media `{url}` fetch stores non-media bytes ✅ decided

`fetch_remote_media` (<site/src/lib/api/v1/media-request.ts>) stores whatever bytes
a URL returns; a `text/html` 200 error page becomes "audio".

**Fix (hybrid, per Q1/Q2):** validate BOTH the fetched-URL path and multipart uploads.
- New `src/lib/api/v1/validate-media-bytes.ts`:
  - `sniff_bytes()` — positively identify media magics (PNG/JPEG/GIF/WEBP/BMP/WAV/AVI/
    OGG/FLAC/MP3/AIFF/MP4-ftyp/Matroska) AND non-media (HTML/XML/SVG/JSON/PDF/plain-text).
  - `validate_media_bytes({ category, declared_type, bytes })`:
    - reject if sniffed as html/xml/json/pdf/text
    - reject if sniffed media category conflicts (e.g. image → audio endpoint)
    - reject if the DECLARED content-type has a specific media/text category that
      conflicts (octet-stream / application-generic treated as unknown → allowed,
      relying on the magic sniff — avoids false-rejecting obscure valid audio).
- Add `UNSUPPORTED_MEDIA_TYPE = 415` to `ResponseCodes`.
- Call in `media-route-handlers.ts` before `store_bytes` (audio, photo, video-with-bytes).
  `medium → category`: audio→audio, photo→image, video→video.
- Unit test `validate-media-bytes.test.ts`.

## Item 2 — FOOTGUN: multipart 403 for token clients ✅ decided

SvelteKit's CSRF guard runs in `internal_respond` BEFORE the `handle` hook and is
`!DEV`-gated, so it only bites in prod. Server clients send no `Origin` header →
every `multipart/form-data` POST is 403'd. JSON `{url}` uploads are unaffected.
`csrf.checkOrigin` is DEPRECATED in kit 2.63; `trustedOrigins` is a static origin
allow-list that can't whitelist the "no Origin header" case → must carve out in hook.

**Fix (carve-out, per Q3):**
- `svelte.config.js`: `kit.csrf = { trustedOrigins: ['*'] }` (disables built-in) + comment.
- New `src/lib/server/csrf.ts` → `is_cross_origin_form_forbidden(event)` — faithful
  re-implementation of SvelteKit's check (form content types incl.
  `application/x-sveltekit-formdata`; POST/PUT/PATCH/DELETE; origin ≠ url.origin) with
  ONE carve-out: exempt `/api/v1/*` requests carrying an `Authorization` header.
- `hooks.server.ts` handle: `if (!dev && is_cross_origin_form_forbidden(event)) → 403`
  (text, or json when `accept: application/json`, mirroring SvelteKit).
- Unit test `csrf.test.ts`.

Rationale: browsers never auto-attach `Authorization`; cross-origin JS can't set it on
a simple form POST without CORS preflight → a Bearer request is provably not a forged
cookie-riding submission. All cookie-authed form posts keep full protection.

## Item 3 — DOCS: list max page size / entry_count consistency ✅ already documented

openapi already states `limit` default 100 / max 500 (line 618, 625) and `entry_count`
eventual-consistency (566, 610). No change (per Q4).

## Item 4 — DOCS + feature: exact lexeme match ✅ decided

- entries GET (`+server.ts`): add `match=exact` → `EXISTS (SELECT 1 FROM
  json_each(entries.lexeme) WHERE json_each.value = ?)` (exact across locales,
  case-sensitive). Default stays substring (`lexeme LIKE %x%`).
- openapi: update `lexeme` param desc + add `match` param (enum substring|exact).
- Test in `entries/server.test.ts`.

## Docs polish tied to item 1
- openapi media_attach_op: add `415` response (invalid/mismatched media content).

## Verify
`pnpm --filter site test` (new + existing), `pnpm --filter site exec tsc --noEmit`
(or `pnpm check`), `pnpm --filter site lint`.

## STATUS — ✅ COMPLETE

- ✅ Item 1: `validate-media-bytes.ts` + `.test.ts` (10 tests); wired into
  `media-route-handlers.ts` (both multipart + url paths); `ResponseCodes.UNSUPPORTED_MEDIA_TYPE`;
  existing `media-route-handlers.test.ts` fixtures updated to real magic bytes + 2 new 415 tests.
- ✅ Item 2: `svelte.config.js` `csrf: { trustedOrigins: ['*'] }`; `src/lib/server/csrf.ts` +
  `.test.ts` (9 tests); wired into `hooks.server.ts` (`!dev`-gated, json/text parity).
- ✅ Item 3: no change (already documented — confirmed).
- ✅ Item 4: `match=exact` (json_each) in entries GET + test; openapi `lexeme`/`match` params.
- ✅ Docs polish: openapi media `415` response.

Verified: 161 tests pass, `pnpm check` 0 errors, lint 0 errors.

KEY GOTCHA (captured in csrf.ts + svelte.config.js comments): SvelteKit's built-in CSRF guard
runs in `internal_respond` BEFORE the `handle` hook and is `!DEV`-gated, so per-route exemption is
impossible while it's on → must disable globally (`trustedOrigins: ['*']`, since `checkOrigin` is
deprecated in kit 2.63) and re-implement in `handle`. `trustedOrigins` can't whitelist the
no-Origin-header case that server clients send.
