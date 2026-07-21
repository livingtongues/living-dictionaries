# Persist hosted-video metadata

Approved parity item from Horse's 2026-07-20 review: cache normalized metadata for both Vimeo and YouTube references while preserving LD's provider identity, attribution rules, and `start_at_seconds`.

## Plan

- [x] Add optional `videos.hosted_metadata` JSON shape (`title`, `description`, `thumbnail_url`, `duration_seconds`) with a dictionary migration, Drizzle type, and JSON-column coverage. Dictionary migrations are auto-discovered, so there is no manual schema-version sentinel to bump.
- [x] Harden hosted URL/provider normalization and add provider metadata adapters. Vimeo oEmbed supplies duration; YouTube oEmbed supplies title/thumbnail. Fetching is best-effort, timeout-bounded, and returns no metadata on network/provider failure.
- [x] Enrich interactive paste before preview/save without blocking valid references when metadata is unavailable.
- [x] Enrich v1 hosted-video attach requests, including raw hosted URL input, while preserving cached metadata on later partial edits.
- [x] Test provider parsing, metadata mapping, failure fallback, attribution/start offsets, v1 endpoint behavior, and preservation on updates.
- [x] Add svelte-look coverage and visually exercise Vimeo, YouTube, invalid, and metadata-unavailable states in light/dark.
- [x] Run focused tests plus root check, lint, and tests.

## Constraints

- Metadata failure never blocks saving a validated reference.
- `hosted_elsewhere` remains provider identity only; metadata lives beside it.
- Existing metadata survives updates that omit metadata.
- Do not commit or push this item.

## Verification

- 60 focused tests pass across URL normalization, provider mapping, database writes/preservation, authenticated interactive metadata endpoint, and v1 routes.
- Root Svelte/TypeScript check and ESLint pass.
- Full Vitest run exits successfully.
- Svelte-look screenshots were inspected in both light and dark modes for YouTube metadata, Vimeo metadata, metadata unavailable, and invalid URL. YouTube rendered its real embed; Vimeo rendered its provider security fallback in the headless environment while retaining the correct embed layout; invalid input was rejected and cleared.
- Mustang dev server was started on port 3041 and svelte-look launched the headless browser itself.
