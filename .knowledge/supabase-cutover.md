# Supabase/Vercel → SQLite/VPS cutover (2026-07-02/03) — the one-page record

THE platform migration, condensed from the retired `.knowledge/migration/` category (2026-07-17;
full detail lives in git history of those pages). All Supabase code is deleted from the repo —
only `scripts/supabase-creds.private` (gitignored) remains on disk. The cutover pipeline itself
lived at `scripts/supabase/cutover/` (also deleted; in git history).

## The flip

- **Phase A (2026-07-02):** full rehearsal ending live on `new.livingdictionaries.app` — 2,229
  dicts / 546k entries pushed to the living VPS (additive rsync, no `--delete`).
- **Phase B (2026-07-03 ~02:30Z):** Supabase frozen read-only, then a delta re-migrated only the
  7 dicts changed since Phase A. DNS flipped ~02:50Z: apex A → `72.61.6.252`, CF proxy ON
  (rollback was `A 76.76.21.21` unproxied → Vercel). `new.`/`www` → apex 301s.
- **Identity: prod id wins.** The VPS was already production for one dictionary (`river`), so the
  migration merged INTO the existing dataset: `users.email` UNIQUE COLLATE NOCASE; Supabase users
  matching an existing VPS user kept the VPS id, Supabase ids remapped across every FK.
- **+1d grace watch (2026-07-04) clean**: R2 snapshots 2232/2232, 706 sessions/35 users day 1,
  editing verified, no systematic errors.

### Future-flip checklist (the operational tails that bit)
1. GitHub deploy webhook still pointed at the old host → deploys silently stop. Repoint + redeliver.
2. CF email worker bakes `LD_VPS_URL` at deploy → update `cf-worker/wrangler.jsonc` + redeploy.
3. Caddy single-file bind-mount inode gotcha: after rsyncing a new Caddyfile, `caddy reload` loads
   the STALE inode → `docker compose up -d --force-recreate caddy`.
4. Env changes need container **force-recreate**, not reload.
5. CF token scopes agents lacked: `Zone · Dynamic Redirect · Edit`, `Zone · Zone Settings · Read`.
6. A shipped `/service-worker.js` self-destruct was needed to kill the old Vercel zombie SW
   (`site/static`-era; unregister + clients.claim + reload pattern).

## Durable engineering residue (still-actionable patterns)

- **U+2028/U+2029 break line-delimited JSON protocols.** `JSON.stringify` leaves them unescaped
  and node `readline` splits on U+2028 → a child process received truncated JSON. Any NDJSON
  protocol must escape both, both directions.
- **Tiptap/ProseMirror leaks ~0.3–0.75MB GC-proof heap per HTML→markdown conversion** (same under
  happy-dom and jsdom). Bulk conversion needs a disposable child process recycled on a count/byte
  budget; the parent must never import the tiptap chain.
- **Non-ASCII slugs in HTTP `Location` headers throw** — encode slugs in every redirect
  (`build_canonical_path`); `/ngəmba/…` 301s to `/ngemba/…`.
- **`CREATE TABLE IF NOT EXISTS` never re-runs** — a DB provisioned from an older migration chain
  silently misses later-consolidated columns. Converge drift explicitly before writing into a
  pulled prod DB.
- **`looks_like_html` heuristics must require a real tag open** (`<` + letter + space/`>`/`/`) —
  a bare `/^\s*</` ate linguistics citation markers (`<< pa`, `< Odia < Telugu` etymology chains)
  and silently dropped text. Loss-detection method that caught it: compare letter multisets of
  original vs converted textContent.
- **Rich-text conversion decisions** (all still live in `site/src/lib/markdown/extensions.ts` —
  editor/converter/reader share ONE extension set): legacy tables kept as cleaned raw-HTML blocks
  (GFM can't do colspan/rowspan; `.issues/future/markdown-tables.md`); underline/smallcaps →
  Pandoc spans (`[…]{.underline}` / `[…]{.smallcaps}`) because the audit found real semantics
  (phoneme letters, run-in headings); render through `sanitize_rich_text` (keeps `span[class]`)
  or the classes strip. Known cosmetic residue: `**bold**` adjacent to CJK/Devanagari/Arabic
  renders literal asterisks (markdown-it flanking rules).
- **A paragraph that is entirely `{…}` is eaten at render** by markdown-it-attrs' end-of-block
  rule — live-editor bug tracked in `.issues/markdown-brace-paragraph-loss.md`; house shares the
  same pandoc-spans setup and latent bug.
- **Hard-delete model:** the SQLite dict schema has no `deleted` column (tombstone `deletes` log
  instead); the migration filtered soft-deleted rows at read time and orphan-pruned children via
  an iterative `foreign_key_check` sweep.

## Also retired at/after the cutover (one-liners; git history has the pages)

- **Auth** rebuilt as Email-OTP + JWT + Google One Tap over the SQLite `users` table (see
  AGENTS.md Auth section) — no external auth service.
- **UnoCSS dropped** (2026-06-12) for the scoped-CSS theme system; never reintroduce.
- **ESLint** consolidated onto a custom flat config + runes-mode finish (2026-06).
- **Legacy read paths** (materialized_entries_view shape) survive only as the snapshot/orama
  bundle row shape in `entry.worker.ts`.
- **Dev `.data` fixtures** come from the example repo (`living-dictionaries-example`), not from
  any legacy pull.
- Supabase/Vercel decommission (the accounts themselves) is Jacob's to schedule; VPS backup
  copies from the cutover were inventoried in `.issues/clean-cutover-backup-files-on-living.md`.
