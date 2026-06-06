# AGENTS.md de-transition + site/src/docs cleanup

Get AGENTS.md out of "migration mode" into stable, forward-looking shape; prune dead
`site/src/docs`; relocate the few durable bits to `.knowledge/domain/`.

## Decisions (from Jacob)
- AGENTS: best possible, no stale references, forward-looking ("how to work now", not history).
  Present tense; VPS deploy is the one remaining milestone via a short orchestration pointer.
- `learn-about-app` SKILL is stale → **delete it**, fold its stable domain-model content into AGENTS.
- Relocated docs → new `.knowledge/domain/` category.
- Delete `site/src/docs/` entirely + the orphaned `site/src/index.md` (kitbook home).

## Tasks
- ✅ Rewrite `AGENTS.md` (folded in domain model + routes; corrected stale facts: kitbook gone,
      R2 snapshot builder ported, dev media mock, cf-worker inbound, supabase relics only in
      scripts/types-folder; present-tense/forward-looking; deploy as the one remaining milestone).
- ✅ Delete `.claude/skills/learn-about-app/` + remove its references (only AGENTS + itself).
- ✅ Create `.knowledge/domain/index.md` + 3 pages:
      `related-entries-model.md`, `media-serving-urls.md`, `dictionary-import-process.md`.
- ✅ Update `.knowledge/index.md` to list the new `domain/` category.
- ✅ Delete `site/src/docs/` (12 files) and `site/src/index.md` (kitbook home).
- ✅ Verify: `pnpm --filter=site check` → 0 errors (18 pre-existing warnings, unchanged).

## DONE — awaiting Jacob's confirmation.

## Key facts discovered (so a fresh session doesn't re-derive)
- `site/` is Supabase-free. Supabase relics remain ONLY in `scripts/` (`config-supabase.ts`,
  `migrate-to-supabase/`) and the `types/supabase/` folder NAME (hand-maintained types now).
- Dev OTP: `send-code` returns the 6-digit code inline in dev (no inbox); `dev_admin_level` cookie.
- Media in dev: no GCS bucket → uploads served from `/api/dev-media`; photos still use lh3 CDN.
  Builders in `helpers/media-url.ts`.
- R2: snapshots built by `lib/db/server/r2-snapshot-builder.ts`, restored via
  `dict-client/fetch-snapshot.ts`; attachments in `lib/r2/*`.
- cf-worker = `ld-email` inbound relay (Cloudflare Email Routing → R2 attachments → POST
  `/api/messages/email-inbound`). Outbound = VPS SES.
- sqlite-query skill exists (LD proxy ports 4050/4051 dev, 4052/4053 prod).
- `site/src/docs/` is served by nothing (kitbook removed).
