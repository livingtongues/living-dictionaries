# Production cutover record — Supabase/Vercel → SQLite/VPS (2026-07-02/03)

The final record of THE cutover. Rehearsal/conversion detail lives in
[supabase-cutover-conversions.md](./supabase-cutover-conversions.md); this page captures the flip
itself, the final production state, and what the grace watch confirmed. The blow-by-blow runbook
(`.issues/cutover.md`) was deleted after completion — this is its durable residue.

## Shape of the move

`livingdictionaries.app` moved off **Vercel + Supabase** onto the **living VPS** (Docker,
blue/green `sveltekit_blue`/`sveltekit_green` behind Caddy, SQLite under `/opt/hosting/data`). The
VPS was already real production for one dictionary (`river`, built via the v1 API), so the cutover
**merged Supabase INTO the existing VPS dataset** rather than seeding blank:

- **Identity: prod id wins.** `users.email` UNIQUE COLLATE NOCASE; every Supabase user matching an
  existing VPS user kept the VPS id, and the Supabase id was remapped across all migrated FK
  columns — so `river.db`, api_keys, chat, and client_logs stayed byte-untouched.
- **Phase A (2026-07-02):** full rehearsal that ended live on `new.livingdictionaries.app` — 2,229
  dicts / 546k entries pushed to the VPS (additive rsync, `river.*` excluded, no `--delete`).
- **Phase B (2026-07-03 ~02:30Z):** Supabase frozen read-only (INSERT/UPDATE/DELETE revoked from
  anon+authenticated), then a cheap **delta** re-migrated only the 7 dicts changed since Phase-A
  start (`--since 2026-07-02T16:24:36Z`); `dictionary_info` + shared tables always full-re-upsert.

## The DNS/domain flip (2026-07-03 ~02:50Z)

- Apex A record → `72.61.6.252`, Cloudflare proxy **ON**. **Rollback = A `76.76.21.21`, unproxied**
  (Vercel).
- `ORIGIN` env → apex in `vps-setup/secrets-decrypted/sveltekit-living.env`; both blue+green
  **force-recreated** (env changes need recreate, not reload).
- `new.` → apex 301 (path+query preserved); `www` → apex 301 via a CF **Dynamic Redirect** rule.
- The shipped `/service-worker.js` is the **kill** for the old Vercel zombie SW (see
  [service-worker-cutover.md](./service-worker-cutover.md)).

### Operational tails that bit (all handled) — reuse this checklist for any future flip
1. **GitHub deploy webhook** points at the old host → deploys silently stop. Repoint Payload URL to
   `https://livingdictionaries.app/hooks/deploy` and redeliver (needs `admin:repo_hook` — Jacob).
2. **CF email worker (`ld-email`)** bakes `LD_VPS_URL` at deploy → set to apex in
   `cf-worker/wrangler.jsonc` + redeploy (needs CF creds).
3. **Caddy single-file bind-mount inode gotcha:** after `bin/sync living` rsyncs a new Caddyfile,
   `caddy reload` loads the STALE inode → `docker compose up -d --force-recreate caddy`.
4. **CF token gaps** found for agent work: `Zone · Dynamic Redirect · Edit` (Config Rules does NOT
   cover it), `Zone · Zone Settings · Read`.
5. **Snapshot state preservation:** `map_dictionary` must NOT emit `snapshot_uploaded_at` and the
   delta must NULL it only for content-rebuilt dicts — else all 2,231 snapshots re-sweep before the
   flip. The delta upsert preserved prod's flags (only the 7 delta dicts rebuilt).

## Bugs surfaced by real production traffic (all fixed)

- **U+2028 LINE SEPARATOR** in content split the NDJSON migration protocol line (node readline
  treats it as a newline) → richtext child died. Fixed via `to_ndjson_line` escaping.
- **Non-ASCII dictionary slugs** (`mišär-tatar`, `ngəmba`, `nağaybäk`) → SSR `redirect()` threw
  `Invalid redirect location … characters that cannot be used in HTTP headers` (raw UTF-8 in the
  `Location` header). 10 server crashes on cutover morning; **fixed by commit `0068a0d7`** (encode
  the slug in every dict redirect + `build_canonical_path`). Zero recurrence since. A non-ASCII slug
  now cleanly 301s to its ASCII canonical (`/ngəmba/entries` → `/ngemba/entries`).
- **Markdown brace-paragraph loss** — a paragraph that is entirely `{…}` is eaten at render by
  markdown-it-attrs' end-of-block rule (stored brace-escaped as a workaround; live-editor bug in
  `.issues/markdown-brace-paragraph-loss.md`).

## Final state confirmed by the +1d grace watch (2026-07-04)

Healthy across the board: blue+green+caddy up, healthz/SSR 200, **R2 snapshots 2232/2232 (0 NULL)**,
706 prod sessions / 35 users day-1 with a real global spread (US, MX, MY, IT, IN, AU, Botswana,
Cameroon, Colombia…), editing working (114 `entry_created`, no `write_blocked`/`dirty_rows_stuck`),
`sync_failed` all transient client network blips (no systematic 5xx). Ongoing low trickle of
`leader_boot_failed` (~22/day, mostly self-healing `opfs_open` retries) tracked in
`.issues/leader-worker-boot-hang-robustness.md`.

## Aftermath / where the legacy surface went

- **Read-time HTML shim deleted** (2026-07-04) — `site/src/lib/markdown/html-era-shim.ts`; all
  content is markdown now, so `rich_text_display_html` calls became plain `render_markdown_to_html`
  and the on-edit HTML→markdown conversions were removed. The cutover tooling that still needs HTML
  detection carries its own `scripts/supabase/cutover/looks-like-html.ts`.
- **All Supabase-coupled `/scripts` tooling moved under `scripts/supabase/`** (connector + creds +
  cutover pipeline + entry-caches + delete-media + reset-local-db). The useful tools that only
  *currently* touch Supabase — `scripts/import/` (FLEx/CSV) and `scripts/download-audio.ts` — stay
  in place and import `scripts/supabase/config-supabase`; their SQLite port (which severs the last
  dependency) is tracked in `.issues/post-cutover-teardown.md`.
- **Jacob keeps Supabase reachable on purpose** — creds + connector stay in hand for legacy
  lookups; Vercel/Supabase decommission is Jacob's to schedule. Backup DB copies on the VPS
  (`/opt/hosting/data/*.bak-*`) are inventoried in `.issues/clean-cutover-backup-files-on-living.md`.
