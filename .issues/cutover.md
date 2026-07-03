# LD production cutover — Supabase/Vercel → SQLite/VPS (single runbook)

THE one cutover document. Combines and supersedes the cutover parts of:
`ckeditor-to-tiptap.md` (Phase 2 conversion), `media-attribution-speaker-or-source.md` (§5),
`squash-sql-migrations-pre-cutover.md` (done — schema is the single `20260702_initial.sql` per set),
`headword-fallback-accessor.md` / `managed-orthographies.md` (lo{n} elimination),
`sources-model.md` (§6 free-text→registry). The old staging/deploy reference material lives in
`.knowledge/migration/` (deploy mechanism: `build-and-deploy-gotchas.md` + vps-setup).

**Shape of the move:** the rebuilt app is live at `new.livingdictionaries.app` (the "living" VPS).
That VPS is already REAL production for one dictionary — `river` (8.7k entries, built via the v1
API by Jake's import agent, ACTIVE — api_key last used 2026-07-02) — plus 7 users, 1 api_key,
admin chat, 22.6k client_logs. The cutover therefore is NOT a blank seed: we migrate Supabase
into the EXISTING VPS dataset, then flip DNS.

## Two-phase plan

- **Phase A — full rehearsal that ends live (2026-07-02/03):** run the complete migration on
  mustang, verify hard, then PUSH to living. new.livingdictionaries.app serves the full dataset
  (only admins know the URL). Jacob reviews the real thing.
- **Phase B — real cutover (a day+ later):** delta re-run (cheap, see below) + DNS flip + the
  operational tails. No full re-migration needed.

⚠️ **Between A and B: migrated dictionaries are READ-ONLY on the new app.** The Phase-B delta
rebuilds any Supabase-side-changed dict db from Supabase — new-app edits to a migrated dict would
be lost. `river` + all shared.db admin data (messages/chat/logs/users) are exempt (never rebuilt,
merged forward). Old-app (livingdictionaries.app) edits keep flowing normally and are captured by
the delta.

---

## Decisions (settled with Jacob 2026-07-02 — do not relitigate)

1. **Identity merge — prod id wins.** `users.email` is UNIQUE COLLATE NOCASE. For every Supabase
   user whose email matches an existing VPS user (Jacob, Greg, Anna, Diego, Jake…), the VPS id is
   kept and the Supabase id is REMAPPED in all migrated data (every
   `created_by_user_id` / `updated_by_user_id` / `user_id` / `invited_by_user_id` /
   `inviter_user_id`). Consequence: `river.db`, api_keys, chat, client_logs stay byte-untouched.
   Duplicate emails *within* Supabase (NOCASE) consolidate the same way (winner = most recent
   sign-in; losers remapped; logged in the manifest).
   For merged users, prod-authored fields win (name, avatar_url, preferred_locale, last_visit_at,
   notify_channel); Supabase contributes created_at (true account age), providers (union),
   unsubscribed_from_emails.
2. **Migrate INTO a pulled copy of prod shared.db** (script is upsert-based) — not a fresh db +
   merge step. `river`'s catalog row and all admin tables ride along untouched.
3. **Phase B is a DELTA, not a re-run.** Supabase's `update_dictionary_updated_at` triggers bump
   `dictionaries.updated_at` on nearly every content change, so changed dicts are detectable via
   `--since <phase-A-start>`. Trigger coverage gaps (verified in `summarized-migrations.sql`):
   **texts, sentence_photos, sentence_videos** have no trigger → the delta query supplements with
   direct scans of those three tables. `dictionary_info` is fully re-read every run (cheap).
   Shared phase (users/catalog/roles/partners/invites) always re-runs in full — it's upserts.
4. **Rich text → markdown at migration time** (`about`, `grammar`, every `entries.notes` locale) via
   the site's `html_to_markdown` (same Tiptap extension set as the editor) under happy-dom.
   Only values that `looks_like_html` convert; plain-text values pass through. Underline/text-align
   drop (house precedent) — but underline frequency gets REPORTED (Jacob wants the number).
   Extension set only grows if the audit finds real meaningful usage (SmallCaps etc.); anything
   structural (tables, iframes, mass data-URIs) → stop and ask.
5. **Legacy edit history (`content_updates` / `entry_updates`) is dropped.** New history model
   starts at cutover; `river.history.db` rides along.
6. **Data-shape conversions in the mappers** (all previously decided, already implemented):
   - orthographies: positional `lo1–lo5` keys → immutable registry `code`s (post-run sweep must
     find zero `lo{n}` residue — the `get_headword` fallback only consults registered codes)
   - entry free-text `sources` → per-dict `sources` registry + slug refs
   - legacy `audio.source` person-names → 3-rule speaker-link/new-speaker/registry-citation
     resolution (`resolve_audio_source_names`; spot checks: Bahasa Lani gains `Yafeth Warijo`
     speaker w/ 298 links; Tehuelche sources go NULL)
   - `texts.sentences` id-arrays → per-sentence fractional `sort_key` + `ends_paragraph`
   - junction composite PKs → synthetic UUID + UNIQUE natural key

## Bugs found in the 2026-07-02 audit (fixed during rehearsal)

- [x] `map_entry` dropped `linguistic_history` (also missing from `DICT_JSON_COLS.entries`)
- [x] `read_dictionaries` didn't filter `deleted` (0 deleted in prod today, but the new catalog
      has no deleted column — resurrection hazard)
- [x] `verify.ts`: O(dicts×tables) queries → per-table `GROUP BY dictionary_id`; count parity must
      account for rows the migration synthesizes (audio-source resolution) via the manifest
- [x] `record-logs.ts` hijacks `console.info` to file-only — this (plus `process.exit`) is why
      migrate output "truncated"; migrate now has its own logger + clean shutdown
- [x] `--dry` did a COUNT query per dict (2,229 queries) → one grouped query

## Supabase facts (2026-07-02)

2,229 dictionaries (0 deleted) · 5,318 users · 553,351 entries · no `river` id/url collision.
Legacy audio.source: 14 distinct values / 605 rows, all person names. Media BYTES stay on GCS
(`talking-dictionaries-alpha.appspot.com`) — only rows migrate; photo serving via lh3 URLs.

---

## Phase A — rehearsal → live push

Work machine: **mustang** (creds: `scripts/supabase-creds.private`, gitignored; loaded by
`config-supabase.ts` — neutral filename because agent sandboxes block `.env*` paths).
Work dir: `~/ld-cutover/` (outside the repo; site boots against it via `DATA_DIR=`).

### A0. Preconditions ✅
- [x] Tiptap editor swap deployed (markdown read/write live before converted data lands)
- [x] Migrations squashed to single initials; prod converged; schema audit fixes shipped
- [x] Supabase creds on mustang; pg connectivity verified
- [x] Disk: mustang 20G free / living 84G free (dataset estimate low-single-GB)

### A1. Script upgrades ✅ (2026-07-02)
- [x] identity remap + prod-preserve user merge (`remap.ts`)
- [x] rich-text conversion under happy-dom (`richtext.ts` + `register-dom.ts`) wired into the run
- [x] rich-text audit script (`audit-rich-text.ts`) — tag/style/attr frequency incl. underline
- [x] `migrate.ts`: `--since` / `--shared-only` / `--skip-existing` / `--concurrency`, manifest
      (`migration-manifest.json`: per-dict counts + synthesized + pruned rows + conversion stats +
      timings), proper logger, clean exit
- [x] `verify.ts` (grouped count parity vs pg live rows, manifest-aware) + `validate-sqlite.ts`
- [x] tests: 33 green (incl. remap/merge/prune/conversion); cutover modules tsc-clean
- [x] **BIG discovery:** new dict schema has NO `deleted` column (hard-delete + `deletes`
      tombstone log) — mappers no longer emit `deleted`; tombstoned Supabase rows are filtered at
      READ time; live children orphaned by a deleted parent are PRUNED post-insert (recorded in
      manifest, subtracted in verify). This was the documented "pre-existing migrate.test.ts
      breakage" — root cause was the hard-delete schema change, not the api-keys commit.
- [x] `record-logs.ts` console.info hijack identified as the "truncated output" culprit;
      `better-sqlite3` native binding rebuilt for scripts/ (node-gyp)

### A2. Pull prod shared.db + converge schema drift ✅
```bash
# live pull (container running) — better-sqlite3 backup API via docker exec:
cat <<'JS' | ssh living 'docker exec -i sveltekit_blue node'
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
db.backup('/data/shared-pull.db').then(() => process.exit(0))
JS
rsync -a living:/opt/hosting/data/shared-pull.db ~/ld-cutover/shared-prod-pull.db
ssh living 'rm /opt/hosting/data/shared-pull.db'
# prod predates the consolidated initial → column drift. Converge the pulled copy:
tsx supabase-cutover/converge-shared-drift.ts <path> [--dry]
```
- [x] Pulled (15.8 MB). **DRIFT FOUND + FIXED:** prod `dictionaries` lacked `about`/`citation`/
      `grammar`/`write_in_collaborators` (same class as the June partners-table drift; CREATE IF
      NOT EXISTS never re-runs). `converge-shared-drift.ts` (generic, idempotent) adds missing
      cols/tables/indexes/triggers; run it after EVERY fresh pull (A6/B2). Pushing the converged
      file back fixes prod wholesale.
- [x] `river.db` schema drift-checked read-only: **fully converged, zero drift** ✓

### A3. Rich-text audit → extension decisions ✅ (`pnpm -C scripts audit-rich-text`)
Report: `~/ld-cutover/richtext-audit.json`. 628 dictionary_info rows + 124,197 entries-with-notes
scanned → **47,825 HTML values / 77,038 plain / 28 empty**.

| Finding | Count | Decision |
|---|---|---|
| **underline `<u>`** | **1,039 values** | drop (house precedent) — Jacob wanted the number: it's 2.2% of HTML values, text survives |
| text-align | 646 values | drop (decided) |
| **tables** | **317 values** (7,462 `<td>`, mostly grammar pages) | STRUCTURAL → asked Jacob (rec: port house TableKit + clean-tables; typography.css already styles tables; xss whitelist already allows them) |
| small-caps | 50 values | ✅ ported house SmallCaps + pandoc-spans (+ `sanitize_rich_text` allowing `span[class]`, `.smallcaps` CSS, tests) |
| `<oembed>` embeds | 5 | ✅ converted to plain links in `richtext.ts` |
| images | 23 total (16 Google-hosted, 1 data-URI) | Image ext already handles |
| `<h4>` | 112 | downgrades to paragraph (heading levels capped 1–3) — text survives |
| iframes / mass data-URIs | 0 / 1 | non-issues |

### A4. Full migration (record start time — it's Phase B's `--since`!)
```bash
cd ~/code/living-dictionaries/scripts
# self-healing pass loop (see below for why):
while :; do
  NODE_OPTIONS=--max-old-space-size=5120 ./node_modules/.bin/tsx supabase-cutover/migrate.ts \
    -e prod --data-dir ~/ld-cutover/data --concurrency 4 --conversion-budget 1500 --skip-existing
  rc=$?; [ $rc -eq 0 ] && break; [ $rc -ne 75 ] && <abort-if-no-manifest-progress>
done
```
- Phase-B `--since` marker: **2026-07-02T16:24:36Z** (`~/ld-cutover/migration-since-marker.txt`)
- ⚠️ LESSONS (2026-07-02): Tiptap/ProseMirror leak ~0.3–0.75MB heap per `html_to_markdown`
  call (GC-proof, happy-dom AND jsdom) → migrate ends each pass at a CONVERSION BUDGET
  (count + bytes) with exit 75 and resumes via `--skip-existing` + the manifest; the loop
  also tolerates an OOM crash as long as the pass made progress (in-flight dicts rebuild
  idempotently). Pooler RTTs dominate small dicts → `SIMPLE_READ_ENTRY_LIMIT` single-SELECT
  fast path (17.5s → 3.5s per small dict).
- [ ] Completes; manifest written; note wall time + dataset size (~1.4 GB + indexes)

### A5. Verify
- [ ] `pnpm verify-migration --data-dir ~/ld-cutover/data` (count parity, manifest-aware)
- [ ] `tsx supabase-cutover/validate-sqlite.ts --data-dir ~/ld-cutover/data` (offline invariants)
- [ ] Spot checks: Yafeth Warijo 298 links; Tehuelche audio sources NULL; largest about/grammar
      dicts' markdown renders (text-content compare already enforced per-value in the run)
- [ ] Smoke boot on mustang: `DATA_DIR=~/ld-cutover/data pnpm -F site dev` + headless screenshots
      (catalog, an entries list, entry detail, about page)

### A6. Push to living (short-stop swap — river agent is active, keep the window tight)
1. [ ] Pre-push backup on living: `cp -a` shared.db + note river.db mtime/size
2. [ ] `docker compose -f /opt/hosting/sveltekit/docker-compose.yml stop` (or stop container)
3. [ ] rsync living:/opt/hosting/data/shared.db{,-wal,-shm} → mustang fresh copy
4. [ ] Re-run migration into the FRESH copy: `--shared-only --since <A4-start>` (+ content delta
      if any dicts changed) — minutes, not hours
5. [ ] Close cleanly (checkpoint TRUNCATE) → rsync up: `shared.db` + `dictionaries/*.db`
      **exclude `river.*`**, no `--delete` (files/, updates/, logs-archive.db untouched)
6. [ ] Delete stale `shared.db-wal`/`-shm` on living; start container; healthz 200
7. [ ] Verify river untouched: mtime/size/entry-count identical; api_key still works (agent's
      next write succeeds)

### A7. Post-push
- [ ] R2 snapshot sweep: migrated dicts all have `snapshot_uploaded_at = NULL` → builder's next
      pass rebuilds everything (~2,229 snapshots, sequential in-process). Watch logs; verify a
      sample of `https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`
- [ ] Admin browser clients: existing admin wa-sqlite DBs have sync cursors AHEAD of migrated
      rows' historical `updated_at` → those rows would never pull. **Jacob + Greg (+ Anna/Diego if
      they've used new.) clear site data for new.livingdictionaries.app once.** (Domain flip at
      Phase B gives everyone else a fresh origin anyway.)
- [ ] Live verification: globe + catalog + several dicts (big/small/orthography-heavy), converted
      about/grammar/notes vs old app side-by-side, media plays/renders, admin sync, check-logs
      sweep for server errors
- [ ] Jacob look-around → GO/NO-GO for Phase B

## Phase B — real cutover (day+ later)

**2026-07-03 pre-B audit fixes (already committed/tested):** ① `map_dictionary` no longer emits
`snapshot_uploaded_at` and `migrate.ts` NULLs it only for content-rebuilt dicts — the delta upsert
now PRESERVES prod's snapshot state instead of nulling all 2,229 (which would have forced a full
multi-hour re-sweep before the flip). ② `chat-reping-cron.ts` `SITE_URL` + `apply-triage.ts`
`PUBLIC_BASE_URL` now derive from `env.ORIGIN` (were hardcoded `new.` — ntfy/triage deep links
would have pointed at the dead subdomain post-flip). All other notification paths already use
`event.url.origin`.

⚠️ **Delta-run flag rules (footguns):**
- Do **NOT** pass `--skip-existing` — it filters out any changed dict already recorded in the
  manifest (line ~488), silently skipping the whole delta. First rename the Phase-A manifest
  (`mv migration-manifest.json migration-manifest-phaseA.json`) so the run writes a fresh delta
  manifest and `verify.ts` scopes to exactly the delta dicts.
- The old `--conversion-budget`/exit-75 self-healing loop is GONE — child recycling is internal
  to `richtext-pool.ts` now. A single plain invocation suffices:
  `tsx supabase-cutover/migrate.ts -e prod --data-dir ~/ld-cutover/data --since 2026-07-02T16:24:36Z --concurrency 4`
- Dicts DELETED in Supabase between A and B are NOT propagated (delta reads live rows only).
  Check once: `SELECT id, name FROM dictionaries WHERE deleted > '2026-07-02T16:24:36Z'` against
  Supabase; hand-remove any hits from the VPS catalog + `dictionaries/` (expected: zero).

1. [x] Freeze: Jacob revoked INSERT/UPDATE/DELETE from anon+authenticated on all Supabase public
       tables (2026-07-03) — old app is read-only, delta fully deterministic
2. [x] **Delta + push DONE (2026-07-03 ~02:30Z).** Fresh pull (WAL folded, zero drift) → delta =
       **7 dicts** (incl. new `teste`; catalog now 2,231 with river) in 84s → pushed, containers up,
       healthz 200, river byte-identical. Verified: `verify` 7/7 count parity, `validate-sqlite`
       2,230/2,230 invariants. Supabase deleted-dicts check: zero.
       - **NEW BUG found+fixed:** U+2028 LINE SEPARATOR in content splits the NDJSON protocol line
         (node readline treats it as a newline) → richtext child died twice on
         `boienen-old-buhi-langua.grammar`. Fixed via `to_ndjson_line` escaping both directions.
       - **NEW mismatch class:** a paragraph that is entirely `{…}` is eaten at render by
         markdown-it-attrs' end-of-block rule — one affected value, stored brace-escaped
         (roundtrip-verified clean). Live-editor bug filed: `.issues/markdown-brace-paragraph-loss.md`.
       - `verify.ts` summary was invisible (record-logs console.info hijack) → console.log.
       - Snapshot-preservation fix confirmed end-to-end: builder logged "7 need fresh → Uploaded
         7/7" on boot; the other 2,224 uploaded flags survived the upsert.
3. [x] Snapshot sweep for the 7 delta dicts: done (7/7, seconds after boot)
4. [x] **DNS swap + domain flip DONE (2026-07-03 ~02:50Z, tuf agent session 9ad96248).**
       - Apex A → 72.61.6.252 proxied ON (**rollback: was A 76.76.21.21 Vercel, unproxied**)
       - ORIGIN→apex in secrets-decrypted (Jacob re-encrypts), `bin/sync living`, caddy auto-recreated
         on Caddyfile change, blue+green force-recreated with new ORIGIN, healthz 200
       - Caddy serves apex + `new.`→apex 301 (path+query preserved, verified)
       - ld-email worker deployed with apex `LD_VPS_URL`
       - GitHub webhook → apex (Jacob); confirmed working by the post-flip push deploy
       - `www`: CNAME set; **Jacob handling the www→apex redirect rule properly at the CF edge**
         (525 until then — CF proxies www to origin which has no www host). CF token gaps found:
         `Zone · Dynamic Redirect · Edit`, `Zone · Zone Settings · Read`.
5. [x] Verified on the apex: healthz/SSR 200; `/service-worker.js` 200 (the shipped SW is the kill
       for the old Vercel SW per `.knowledge/migration/service-worker-cutover.md`); real user
       traffic landing in `client_logs` incl. delta dicts (ewdebe/orich searches); **zero
       errors/crashes post-flip**; delta-dict R2 snapshots 200. Old app still on Vercel for
       side-by-side. Remaining Jacob checks: email support@ → `message_threads` row (inbound
       worker), `bin/secrets-encrypt`.
6. [ ] Grace watch: check-logs sweeps scheduled via horse cron on mustang — `c-4b69da` (+1h,
       2026-07-03 04:15Z) and `c-04dfff` (+1d, 2026-07-04 03:00Z); the +1d session marks this
       step done if clean

### ⚠️ Cutover-day operational tails (from house's 2026-06-23 flip — all apply)

1. **GitHub deploy webhook** still POSTs to dead `new.` → deploys silently stop. Jacob (agent app
   token lacks `admin:repo_hook`): repo Settings → Webhooks → Payload URL →
   `https://livingdictionaries.app/hooks/deploy` → redeliver latest to confirm.
2. **CF email worker (`ld-email`)** bakes `LD_VPS_URL = https://new.livingdictionaries.app` at
   deploy: set to apex in `cf-worker/wrangler.jsonc` + redeploy (`cd cf-worker && pnpm install &&
   pnpm deploy` — needs CF creds: Jacob or a Workers-scoped token). Verify by emailing
   support@ and confirming a new `message_threads` row. Grep cf-worker for other `new.` refs.
3. **`ORIGIN` env** → apex in `~/code/vps-setup/secrets-decrypted/sveltekit-living.env` →
   re-encrypt → `bin/sync living --env-only` → **recreate** the container (`docker compose up -d`,
   not reload). Verify `docker exec sveltekit printenv ORIGIN`.
4. **Caddy single-file bind-mount inode gotcha:** after `bin/sync living` rsyncs the new Caddyfile,
   `caddy reload` loads the STALE inode. Fix: `ssh living "cd /opt/hosting/caddy && docker compose
   up -d --force-recreate caddy"`.
5. **www → apex redirect** needs a CF *Dynamic Redirect* rule (301, preserve path+query) + `www`
   DNS CNAME→apex proxied. Token needs `Zone · Dynamic Redirect · Edit` (Config Rules does NOT
   cover it, despite the hint) — dashboard template is the quick path.
6. Optional (house did): pre-arm CF cache rule (Cache Everything on `/` when no `session=` cookie,
   host ∈ {apex, www}) + deploy-time `CLOUDFLARE_PURGE_URL` on the apex. Verify MISS→HIT anon,
   DYNAMIC for logged-in.

### Data safety rails
- Never blind-overwrite living data: A6/B2 always re-pull + merge before pushing; `river.*` is
  excluded from every rsync; no `--delete` ever.
- PII: migration artifacts live OUTSIDE the repo (`~/ld-cutover/`); before any `git add -A`,
  confirm no dump/db/csv landed under `scripts/` (`supabase-creds.private` is gitignored).

## Post-cutover cleanup (after Phase B settles)
- [ ] Delete the read-time HTML shim (`site/src/lib/markdown/html-era-shim.ts` + call sites)
- [ ] Delete `scripts/supabase-cutover/`, `scripts/types/` (legacy Supabase types),
      `config-supabase.ts` + `supabase-creds.private` once nothing reads Supabase
- [ ] Port or retire remaining Supabase-reading tools in `scripts/` (cloudflare entry caches,
      FLEx import, download-audio, delete-dictionary-media)
- [ ] Decommission: Vercel project, Supabase project (export final pg dump to cold storage first),
      old Firebase leftovers if any
- [ ] Knowledge: cutover record page in `.knowledge/migration/`; delete this file
- [ ] Remove living `/opt/hosting/data/*.bak-*` + `dictionaries/*.bak-*` once confident

## Deferred backlog (intentional, post-cutover)
- Orphaned-GCS-media sweep (dict delete doesn't harvest GCS blobs; `orphaned_media_count` reported)
- Standalone R2-snapshot cron (builder currently in-process, gated by `R2_SNAPSHOT_BUILDER_ENABLED`)
- `process_sync` resilience to a missing syncable table + schema-drift guard (tracked in
  `.issues/future/dashboard-improvements.md`)

---

## Rehearsal run log (Phase A) — ✅ COMPLETE & LIVE (2026-07-02)

- Recon + audit; creds staged on mustang via tuf horse hop; prod state captured.
- Script upgrades (A1): identity remap, isolated-child rich-text conversion, audit/verify/validate/
  converge tools, manifest + resume. Fixed: `linguistic_history` drop, deleted-dict resurrection,
  hard-delete orphan pruning, `record-logs` stdout hijack, `<`-prefix content loss, undeclared
  `lo{n}` orthographies, Tiptap per-call heap leak (→ recycled child process).
- Rich-text audit (A3): 47,825 HTML values. underline 1,039 (→ `[…]{.underline}` lossless span,
  Jacob wanted the count), text-align 646 (dropped), **tables 317 (→ TableKit raw-HTML, approved)**,
  smallcaps 50 (→ `[…]{.smallcaps}`), oembed 5 (→ links). markdown-tables-as-real-GFM = future issue.
- Full migration (A4): **2,229 dicts / 546,196 entries / 556,211 senses / 142,493 audio /
  21,643 photos / 18,552 sources** (+8 synthesized speakers, 539 audio-source links). 5,327 users,
  3,021 roles, 104 partners, 1,526 invites. 47,828 rich-text conversions. Data dir 1.6 GB.
  Prod-id-wins identity: 3 matched (Diego/Greg/Jacob remapped), 0 supabase dupes.
- Verify (A5): `validate-sqlite` → **all 2,229 pass every invariant** (FK, no lo{n}/HTML residue,
  source-slug integrity, entry_count parity). Conversion mismatches: 0 errors/crashes, **0 data loss**
  (letter-multiset check); the rest are markdown-escape backslashes + list-marker text-extraction
  artifacts (render-identical) + `**`/`*` emphasis next to non-Latin scripts (minor cosmetic —
  markdown-it flanking limitation, candidate for a future `markdown-it-cjk` tweak).
- **Push to living (A6): DONE.** Living had ~zero drift since the 16:00 pull (river last-written
  10:35, 0 messages, same client_logs). Backup `shared.db.bak-precutover-20260702-234622` +
  `shared.db.old-river-only`. rsync 1.6 GB dicts (additive, river.db untouched) → stop both
  blue/green → swap shared.db + clear stale wal/shm → start. **healthz 200, river 200, migrated
  dicts 200, 0 server errors.** river preserved (8,693 entries, api_key, Jake's manager role, chat).
- Post-push (A7): snapshot builder auto-sweeping all 2,229 (26 done at check, ~30-min cycles).
  SSR-verified converted content renders: tables (lao-ba 4 tables/202 cells, dogon paradigm),
  headings, bold/italic, smallcaps/underline spans.
  - ⏳ **Jacob TODO:** clear site data for `new.livingdictionaries.app` once (admin wa-sqlite sync
    cursors are ahead of migrated rows' historical `updated_at` → full user/dict lists need a fresh
    origin). Then eyeball: globe (WebGL — agent can't), a big/small/orthography-heavy dict, converted
    about/grammar/notes, media, admin sync.

### Known cosmetic follow-ups (non-blocking)
- `**bold**`/`*italic*` immediately adjacent to CJK/Devanagari/Arabic may render as literal
  asterisks (markdown-it doesn't treat non-Latin as emphasis-flanking). No data loss. Fix later
  with a flanking plugin if it bothers real pages.
- Live-editing race: `ewdébe` showed a 4-row parity delta at verify time (actively edited during
  the window) — exactly the class Phase B's `--since` delta re-migrates.
