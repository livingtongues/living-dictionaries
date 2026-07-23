# Media migration: GCS → R2 (audio/video first, photos second) + LD-account media backup

Decisions locked with Jacob 2026-07-23. Phases 1–3 (provision, fat cleanup, code audit) DONE;
next: the migration driver (phase 4).

## Decisions (Jacob-confirmed)

- **No dashboard first** — go straight at the migration; sizes fall out of the copy manifest;
  `/admin/storage` gets built afterwards FROM R2 data (admin-only).
- **Normalize keys** during copy: `{dict_id}/{audio|video|photo}/{row_id}.{ext}` — every
  dictionary gets its own folder. Rewrite `storage_path` in each dict.db with sync-safe updates
  (`updated_at` + `server_seq` bumps), dict-by-dict: copy → verify → update rows → snapshot
  rebuild → next dict. GCS's mixed legacy naming (dict-first vs `audio/{dict}` type-first) dies here.
- **Skip orphans**: do NOT copy media belonging to deleted dictionaries or unreferenced objects.
  Copy manifest = DB rows of live dicts, not a bucket listing.
- **New bucket**: `livingdictionaries-media` on the **Living Tongues CF account** (94e4ac…), public
  via custom domain `media.livingdictionaries.app` (same pattern as snapshots bucket).
- **GCS stays untouched** for a while after migration (failsafe for stale clients + extra backup
  layer). One big teardown later, only after photos are also resolved. Jacob wants to WAIT — do not
  rush teardown.
- **Photos (Phase 2)**: pre-generate a fixed variant set at migration time (square thumb ~s400-crop,
  w900, w1600, original) — the app only uses 7 lh3 size specs (`s150-p s340-p s400-p w900 w1200
  w1600 s0`, see `src/lib/helpers/media-url.ts`). New uploads generate variants server-side (sharp).
- **Site-code uniformity audit**: before/while flipping upload targets, verify ALL write paths save
  to the new key convention: `/api/upload` (browser presigned PUT), `store_media_bytes` (v1 API
  server-side), and anything else that writes media. Jacob thinks it's uniform — verify.
- **Backup relocation (Jacob 2026-07-23)**: LD media backups move OUT of poly's `backups-rolling`
  into the Living Tongues account — "something protected and similar set up in living's cloudflare
  area". Git/repo backups stay in poly's backups-rolling. Motivated by a billing scare (see below).

## Billing investigation findings (2026-07-23)

Jacob's screenshot: "R2 Infrequent Access - Class A ~$9.00, IA Class B ~$0.90, R2 Data Storage
$0.20, IA Storage $0.03" (donut $10.12). Investigated with the CF admin token (user token, spans
all 3 accounts: Poly 249e33…, Living Tongues 94e4ac…, HVSB aa1fb8…):

- Only IA-class bucket anywhere: poly account's old `backup` bucket (**default class
  InfrequentAccess**, created 2026-04-06, indefinite bucket lock, ~16 GB IA published incl.
  driving.tar.age 8GB + river.tar.zst.age 4.6GB; contents stale since April, nothing reads it).
- GraphQL `r2OperationsAdaptiveGroups` filtered `storageClass: InfrequentAccess` over Apr→Jul on
  ALL THREE accounts: totals are 0–170 ops/month. **Nowhere near 1M ops ($9.00 at IA Class A
  $9/M).** Every high-volume op is tagged Standard:
  - poly `backups-rolling`: 1,429,510 HeadObject + 67,010 CopyObject since Jul 1 (the weekly
    `backup-media` mirror re-checking ~184k gcs-living objects + poly-media timestamped copies).
  - Storage math fits the poly account with a period starting ~Jul 20 (prorated: 151.7GB std ≈
    $0.21, 16GB IA ≈ $0.02).
- Conclusion so far: the IA *storage* line is real (the old `backup` bucket — harmless,
  $0.16/GB-mo… actually ~$0.16/mo total, cheaper than Standard). The IA *ops* charges do NOT
  correspond to any measured IA operations — either the dashboard truncation misleads, the billing
  period is longer than it looks, or Cloudflare is misbilling. Jacob to expand the line items /
  confirm which account the widget is on. Both $9.00 and $0.90 are exactly 1M × the IA unit rates —
  suspiciously round.
- Regardless: the new architecture removes the 1.4M-HEADs/period mirror hammering as a side effect.

## Current media stack (verified earlier)

- GCS bucket `talking-dictionaries-alpha.appspot.com`, public-read; audio/video served via
  `firebasestorage.googleapis.com/v0/b/…?alt=media`; photos via lh3 App Engine Images resizing URLs.
- Upload: browser presigned PUT (GCS S3-interop HMAC) via `/api/upload`; v1 API `store_media_bytes`.
- ~48 GiB / 184k objects total in GCS (from backup-media logs). Rows: ~145k audio, ~21.6k photos,
  ~435 videos.
- In dev there's no GCS: `/api/dev-media` local store.
- Existing R2 backup of GCS media: poly `backups-rolling/mirror/gcs-living/` (add-only mirror,
  1y-per-object lock, no lifecycle) — becomes a frozen archive once the new system is live.

## New backup architecture (living's own CF area)

- New locked bucket on Living Tongues account, e.g. `livingdictionaries-backups` (name TBC with
  Jacob), same security model as poly's backups-rolling (bucket lock ⇒ agent-safe immutability;
  admin token provisions, Object R/W token writes):
  - `media/` prefix: add-only incremental mirror of `livingdictionaries-media` via SAME-ACCOUNT
    server-side `rclone copy` (no egress, Standard-class ops, cheap). Lock semantics TBC
    (recommend: 1y per-object lock, NO lifecycle — same retained-deletions safety net as today).
  - Could later also take the DB snapshot backup legs, but out of scope now.
- Cron: extend mustang's `backup-media` (or a new `backup-ld-media` leg in `backup-all`) — needs an
  LD-account S3 token on the runner (new secret, must go through vps-setup/otter SECRETS_ALLOW flow)
  OR pull LD R2 creds at runtime over fleet SSH from living's env (same pattern as the GCS leg —
  zero new stored secrets; app token is account-wide Object R/W on LD account, verified it can list
  all LD buckets).
- After migration verified: drop the `living` GCS leg from `backup-media` (house leg stays);
  existing `mirror/gcs-living` sits frozen until the eventual GCS teardown.
- vps-setup docs (`bin/backup-media` header, `.knowledge/operations/r2-backup-system.md`) must be
  updated when this lands.

## Execution phases

1. ✅ **Provision (DONE 2026-07-23)**: `livingdictionaries-media` (APAC, Standard) public via
   `media.livingdictionaries.app` (SSL active, serving verified 200); `livingdictionaries-backups`
   (APAC, Standard) with bucket-lock rule `media-mirror-lock-1y` (prefix `media/`, Age 1y) —
   lock PROVEN (delete → "object is locked by the bucket policy" via admin token, 409 via app
   token); CORS on media bucket: PUT from https://livingdictionaries.app + http://localhost:3041,
   expose ETag (mirrors attachments config). Two tiny test objects remain locked in
   `backups/media/` (_lock-test.txt, _rw-test2.txt) until 2027-07 — harmless.
   - **Key finding**: living's env R2 token ("Living Dictionaries VPS R2 Account Token",
     account-owned, id = R2_ACCESS_KEY_ID) is ACCOUNT-WIDE Item Write → already covers both new
     buckets. No new secrets needed anywhere (app env unchanged; backup cron pulls same creds).
   - **rclone gotchas vs R2** (both hit during verification): MUST pass `--s3-no-check-bucket`
     (else preflight CreateBucket 403s and the copy aborts — same reason vps-setup scripts carry
     it) and first PUT attempt may 501 NotImplemented then succeed on rclone's auto-retry
     (checksum/streaming negotiation) — harmless but the driver should tolerate retries.
2. ✅ **Fat cleanup (DONE 2026-07-23)**: legacy `cache` (0.29GB/1,750 obj) + `search-index`
   (1.4GB/1,298 obj) buckets: custom domains cache./index.livingdictionaries.app removed, objects
   purged, buckets deleted. (They were small — earlier "listing times out" was an rclone quirk,
   not object count.) Only live reads were vuln-scanner bots + a trickle of ancient pre-SQLite
   clients fetching entries_data/{dict}.json. LD-account buckets now: backup (5.3GB supabase_sql —
   left alone), snapshots, attachments, + the 2 new ones.
3. ✅ **Site-code audit (DONE 2026-07-23)** — writes ARE uniform; two chokepoints only:
   - **Client**: `/api/upload` presign (`routes/api/upload/+server.ts`, key =
     `{folder}/{Date.now()}.{ext}`) ← `$lib/media/upload-media.ts` ← callers with folders:
     `add-media.ts` (`{dict}/images/{sense_id}` · `{dict}/audio/{entry_id}` ·
     `{dict}/videos/{sense_id}`), `home/hero-image.ts` (`{dict}/featured_images`),
     `contributors/+page.ts` (`{dict}/partners/{partner_id}/logo`).
   - **Server**: `store_media_bytes` (`$lib/server/media-storage.ts`) ← v1 API
     `media-route-handlers.ts` with folders from `MEDIA_CELLS` in `v1-media-write.ts`
     ('audio'|'images'|'videos').
   - **Reads**: `$lib/utils/media-url.ts` — `url_from_storage_path` (audio/video →
     firebasestorage URL; dev → `/api/dev-media`) + `image_src` (photos → lh3). Plus export
     `get-rows.ts` URLs.
   - **New-vs-old path discrimination for dual-read**: NEW convention = exactly 3 segments
     `{dict}/{audio|video|photo}/{row_id}.{ext}`; OLD = 4+ segments (`{dict}/audio/{owner}/{ts}.ext`)
     or legacy type-first (`audio/{dict}/…`). Deterministic + testable.
   - **Consequence of row_id keys**: media row id must exist BEFORE upload → client generates the
     media row uuid pre-upload and passes it through (small change in add-media/guarded-writes);
     v1 server path generates id before `store_media_bytes`. Hero images + partner logos are
     photos → Phase 2 (photos), keep old scheme + lh3 until then.
4. **Migration driver (audio+video) — IN PROGRESS (2026-07-23 session, mustang)**. Refined design
   after code + prod research (supersedes the two older duplicate phase-4 bullets):

   **SEQUENCING CORRECTION (important)**: storage_path rewrites must come AFTER the dual-read
   serving code is deployed — today's `url_from_storage_path` sends EVERY path to the GCS
   firebasestorage URL, so a rewritten row would 404 for synced clients until the flip ships.
   Correct order: (a) copy all objects to R2 (additive, invisible) → (b) deploy dual-read
   serving + upload flip (old phase 5) → (c) run per-dict rewrites + snapshot refresh →
   (d) post-flip sweep = just re-run the pipeline (manifest naturally excludes new-style rows).

   **Prod research findings**:
   - 1,277 dict DBs; 146,690 audio rows, 427 video rows (240 hosted-elsewhere, NULL storage_path
     → skip). Path shapes ARE messy; crucially **46,218 old audio paths are exactly 3 segments**
     (`a-fala/audio/{id}_{ts}.wav`) — the earlier "old = 4+ segments" discriminator is WRONG.
     New-path discriminator = 3 segments AND kind ∈ audio|video|photo AND filename is
     `{uuid}.{ext}` (crypto.randomUUID filenames never collide with old `{id}_{ts}.ext` names).
     Extensions include hyphens (`.x-m4a`) — ext regex must be `[\w-]+`.
   - Rewrite mechanics are SIMPLER than feared: per-dict triggers auto-bump `server_seq` AND
     `db_metadata.last_modified_at` on any UPDATE. So a raw guarded
     `UPDATE {tbl} SET storage_path = @new WHERE id = @id AND storage_path = @old` (via
     `ssh living docker exec sveltekit_blue node`) is fully sync-safe; do NOT bump `updated_at`
     (preserves LWW so genuine concurrent human edits still win; clients pull by server_seq
     regardless). Then mirror the cursor: `UPDATE dictionaries SET updated_at = (dict.db
     db_metadata.last_modified_at) WHERE id = ?` in shared.db → snapshot builder re-snapshots on
     its normal ≤30-min sweep (no manual force-rebuild needed).
   - **Copy sources**: public `storage.googleapis.com/{bucket}/{key}` 403s, but the
     firebasestorage `?alt=media` URL serves 200 (that's the app's own serving path) — so GCS
     fallback needs NO creds. Primary source = poly's R2 mirror
     `r2:backups-rolling/mirror/gcs-living/{old_path}` (mustang's rclone `r2:` remote reaches it;
     free egress, and safe because media objects are never rewritten in place — only
     missing-from-mirror objects fall back to firebasestorage). Dest creds = LD app R2 token
     pulled at runtime over `ssh living` from `/opt/hosting/sveltekit/.env`
     (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY — account-wide, covers the media
     bucket; zero stored secrets).

   **Deliverables**:
   - `site/src/lib/utils/media-path.ts` — pure shared helpers (`is_r2_media_path`,
     `extract_media_extension`, `build_r2_media_key`) + inline vitest; imported by site code AND
     scripts (relative import; pure TS, no $lib deps).
   - `scripts/media-migration/` — `pull-manifest.ts` (ssh + embedded collector → local
     `state.db`), `copy.ts` (mirror-first GET → R2 PUT, concurrency, restartable via per-object
     status; records bytes + content_type — feeds /admin/storage later), `verify.ts` (R2 prefix
     list vs state: count + bytes per dict), `rewrite.ts` (per verified dict: guarded batch
     UPDATE via docker exec + shared.db cursor mirror), shared `lib.ts`.
   - Site flip (deploy between copy and rewrite): dual-read `url_from_storage_path`
     (new-convention → `https://media.livingdictionaries.app/{path}`, else GCS; dev unchanged),
     `/api/upload` audio/video → R2 presigned PUT keyed `{dict.id}/{kind}/{media_id}.{ext}`
     (client mints media_id pre-upload in add_audio/add_video → insert with explicit id; photos
     keep GCS presign until Phase 2), `store_media_bytes` audio/video → R2 put with pre-minted
     row id (v1 path), new `$lib/server/r2-media.ts` client (R2_MEDIA_BUCKET env or hardcoded
     bucket name — same account creds as attachments/snapshots).
   - Secure dicts: media objects land on the public media bucket exactly like GCS today
     (public-read status quo, no regression; noted deliberately).
   - Missing sources (object in neither mirror nor GCS): mark `missing` in state, DO NOT rewrite
     that row (old path keeps failing exactly as it does today) — triage list falls out of state.db.
5. **Serving + upload flip**: `media-url.ts` → media.livingdictionaries.app for new-convention
   paths (keep GCS fallback for old paths during rollout); `/api/upload` + `store_media_bytes` →
   R2 presign/put with new keys. Dev `/api/dev-media` unchanged.
6. **Backup leg**: new same-account mirror cron + retire living GCS leg.
7. **Phase 2 photos**: sharp variant pipeline (thumb/w900/w1600/original), migrate + rewrite,
   flip photo serving off lh3.
8. **Later**: /admin/storage dashboard from R2 manifest + live bucket stats; GCS teardown (Jacob
   decides when).

## Phase-4 session progress (2026-07-23, mustang)

- ✅ `site/src/lib/utils/media-path.ts` — shared pure helpers + tests (uuid-filename discriminator).
- ✅ Driver built in `scripts/media-migration/` (README there): pull-manifest / copy / verify /
  rewrite + `lib.ts`; state in gitignored `state.db`. `rewrite.ts` refuses to run without
  `--confirm-dual-read-deployed`.
- ✅ Manifest pulled: 447 dicts, 146,877 old-convention rows (all row ids verified UUID — 147,117
  checked, zero non-uuid). 0 orphan db files.
- ✅ Copy smoke test + public serving verified (media.livingdictionaries.app 200, correct
  content-type/bytes). FULL COPY RUNNING in background (~21 obj/s ≈ 2h;
  log: `scripts/media-migration/copy-run.log`).
- ✅ Site flip code DONE (not yet deployed): dual-read `url_from_storage_path` (all read surfaces
  funnel through it — verified), `/api/upload` `r2_media` branch (canonical dict id, uuid-enforced,
  dev-mock keeps new keys), `upload-media`/`add-media` pre-mint row uuid, `guarded-writes.insert_audio`
  id passthrough, `store_media_bytes` r2_key branch, new `$lib/server/r2-media.ts`,
  constants `R2_MEDIA_DOMAIN`/`R2_MEDIA_BUCKET` (no new env vars — reuses account creds).
  v1 behavior change: caller-supplied media `id` must be a UUID for audio/video byte uploads
  (openapi already documented `format: uuid`).
- ✅ Tests green (media-path, media-url, media-route-handlers incl. new 400-non-uuid test,
  add-media updated for pre-minted ids), `tsc` clean, eslint clean, `pnpm check` 0 errors.
- ✅ Live dev verification: dev-auth → `/api/upload` r2_media → PUT → GET roundtrip on the new key;
  non-uuid 400; legacy photo presign unchanged.
- ✅ Copy complete (2026-07-23): 146,876/146,877 objects copied + byte-verified across 446/447
  dicts. The 1 exception: `QAThAUaCXUaJVLwZeXEz` test dict, `audio/Test_…/NzPQ…wav` — dead in
  both mirror AND GCS (404'd before migration too); left `missing`, row keeps old path.
- ✅ Flip DEPLOYED (commit 561882e9 pushed by Jacob, verified live on VPS).
- ✅ REWRITES DONE (2026-07-23): all 445 remaining dicts (afmaay first as canary), 146,876 rows
  total, **0 diverged**. Verified on prod: `server_seq` bumped, `updated_at` untouched (LWW
  preserved), shared.db cursor mirrored. Spot-checked gutob/siletz-dee-ni/gta — 0 old-convention
  paths remain, sampled keys serve 200 from media.livingdictionaries.app with right content-type.
- ✅ Snapshot rebuilds confirmed: builder swept 363 stale dicts; 367 fresh uploads within the
  hour, remainder clears on the normal 30-min sweep.
- ✅ Post-flip sweep run: re-pull-manifest found ZERO new old-convention rows (only the known dead
  test object) — no uploads landed on GCS during the window. Audio+video migration COMPLETE.
- ✅ Telemetry clean post-deploy: no media/upload errors; sync_failed at normal baseline
  (30–140/hr stale-client noise, e.g. deleted dict `river`).
- ✅ vps-setup backup-media leg 4 added (add-only server-side mirror → locked
  `livingdictionaries-backups/media/`, runtime-pulled creds); first seed run in flight.
- ✅ AGENTS.md media bullet + `.knowledge/domain/media-serving-urls.md` updated (R2 dual-read).

## Phase 2+3 decisions (Jacob 2026-07-23, third round) — DO IT ALL NOW

Order: **photos migration end-to-end → ledger + delete/reconcile sweep → /admin/storage dashboard.**

- **No GCS listing anywhere in the dashboard** (GCS dies eventually). Sizes live in a server-only
  shared.db **`media_objects` ledger** (dict_id, media_type, key, bytes, uploaded_at; NOT synced):
  seeded from migration state.db bytes (audio/video) + photo-copy records; `+=` at upload time
  (presign endpoint, photo upload endpoint, v1 store_media_bytes); trued-up by the sweep.
- **Deletes: REAL R2 deletion via periodic sweep** with ~30-day grace on orphans (object without a
  live row). Safe because the backups bucket holds a 1-year-locked copy of everything. The sweep =
  delete-cleanup + ledger reconciler + abandoned-upload GC + missing-variant self-heal, in one job.
- **Photo variants: WebP q~80** (thumb 400-square-crop, w900, w1600) + untouched original.
  lh3-spec mapping: s150-p/s340-p/s400-p→thumb, w900→w900, w1200/w1600→w1600, s0→original.
- **New photo uploads: POST bytes to server**; server stores ORIGINAL, responds immediately
  (snappy — Jacob pushed on this), then generates+PUTs variants AFTER the response in-process
  (adapter-node keeps running; crash gap self-healed by the sweep). sharp goes in `dependencies`.
- **Dashboard** (/admin/storage): total · by dict · by category (= `dictionaries.bucket`, attributed
  at query time to CURRENT bucket) · by type within each · trends. Daily rollup
  `media_storage_daily` from the ledger (no R2 calls) + one-time retroactive backfill from media-row
  `created_at` × ledger bytes (monthly cumulative growth curve; can't see already-deleted media).
- After photos land on R2: drop the `living` GCS leg from vps-setup backup-media (house leg stays);
  `mirror/gcs-living` sits frozen until the far-future teardown.

## Phase 2+3 build log (2026-07-23, this session)

- ✅ Audio/video backup mirror seeded: 146,878 obj / 29.1 GiB in `livingdictionaries-backups/media/`.
- ✅ Photo serving core: `photo_src` (dual-read: R2-convention storage_path → WebP variant urls,
  else lh3 via serving_url) + `photo_variant_key`/`variant_for_size_spec` in media-path/media-url;
  ALL image_src call sites flipped (Image/Image2/GalleryImage take `photo` objects now; EntryMedia,
  Cell, ListEntry, GalleryEntry, Partners, HomeEntryCard, PrintEntry, TokenPopover, WordCards,
  FeaturedEntryFullscreen, FeaturedWordsView, dict home cover). SeoMetaTags: `photo` prop, og
  v5 (`image_url` for R2 photos, gcsPath legacy); og +server drops both in text-only fallback.
- ✅ Upload flip: `/api/photo-upload` (multipart POST, contributor+, respond-after-original,
  variants in-process after response via `$lib/server/photo-variants.ts` [sharp, webp q80,
  thumb/w900/w1600, EXIF-rotated]); upload-media.ts image branch → POST; add_photo mints row
  uuid, serving_url ''; hero cover + partner logo mint fresh uuids; partners set_photo accepts
  storage_path-only; v1 photos → r2_key + '' serving_url + background variants (uuid ids enforced
  for ALL media now); /api/upload folder optional (legacy stale-client branch kept until GCS
  teardown, gcs_serving_url endpoint kept too).
- ✅ dev-media GET: missing new-convention keys 302 to media.livingdictionaries.app (pulled dicts
  render real media in dev now).
- ✅ Ledger: shared migration `20260723a_media_objects_ledger.sql` (`media_objects` +
  `media_storage_daily`, server-only); `$lib/db/server/media-ledger.ts`
  (record_media_object_by_key + parse_media_key); writes wired into photo-upload, photo-variants,
  /api/upload presign (declared `file_size`), v1 media.
- ✅ Sweep: `$lib/db/server/media-sweep-cron.ts` — hourly tick; daily rollup; weekly reconcile
  (full R2 list → true-up/adopt/drop, per-dict orphan marking vs live rows incl. partner logos +
  featured_image + derived variant keys, REAL deletion past 30d grace capped 5k/run, variant
  self-heal capped 200/run); registered in hooks.server; `media_sweep_last_reconcile` in
  db_metadata.
- ✅ Dashboard: `/api/admin/storage` (+_call) + `/admin/storage` page (totals cards, type
  SegmentedBar, by-bucket categories w/ type split, growth LineChart w/ type chips, sortable
  filterable dict table) + admin nav link (min_level 2).
- ✅ featured_entries: `photo_storage_path` column (20260723 migration), threaded through
  server module/FeaturedCard/consumers/curate-command doc; rewrite backfills it via photo_id.
- ✅ Driver: pull-manifest-photos (21,800 objects: 21,638 photos + 78 logos + 84 covers — all
  storage_path'd, zero lh3-only), copy.ts photo branch (sharp variants → `variants` state table,
  all-or-nothing per row), verify.ts photo prefix + variant checks, rewrite.ts v2 (photos +
  shared.db partner/featured_image guarded updates + featured_entries backfill),
  seed-ledger.ts (created_at collection → media_objects seed → monthly month-end backfill).
- ✅ tsc / eslint / svelte-check / full vitest green. e2e media-upload.mjs REWRITTEN for the new
  flow (vite dev + dev-media store, real sharp variants asserted on disk, R2-convention key
  assertions) — was stale since the audio flip (still mocked GCS presign + lh3).
- ⏳ Photo copy running (~5.5/s). Then: verify → **Jacob commits+pushes deploy** → rewrite
  --confirm-dual-read-deployed → seed-ledger → photo post-flip sweep → re-run LD backup leg →
  drop living GCS leg from vps-setup backup-media → AGENTS.md photos bullet.

## HANDOFF (session swap 2026-07-23, ~09:20) — new session continues from here

**Copy process** is `nohup`-detached on mustang (survives the old session): started as pid
1877630, `pnpm tsx media-migration/copy.ts` from `scripts/`. Monitor DELICATELY — do NOT assume
the pid; watch `pgrep -f 'media-migration/copy.ts'` + `scripts/media-migration/copy-photos-run.log`
+ state.db counts (`SELECT status, COUNT(*) FROM objects WHERE tbl IN
('photos','partner_logos','featured_image') GROUP BY status`). If it died mid-run just re-run
`pnpm tsx media-migration/copy.ts` — fully restartable/idempotent (only pending/error rows).
Was at ~6,000/21,785, ~6/s (~45 min from then).

**3 sharp-error rows (Jacob: STANDARDIZE these iPhone photos — HEIC is no end of trouble):**
`SELECT tbl,row_id,old_path,error FROM objects WHERE status='error'` — 2 HEIC (iref security
limit), 1 truncated JPEG. Plan: fetch each photo row's `serving_url` from its prod dict.db
(docker exec on living; row ids above), pull `https://lh3.googleusercontent.com/{hash}=s0`
(lh3 transcodes HEIC→standard web format), sharp-normalize to JPEG (`.jpeg()` q~85, .rotate()),
PUT as the original under a **.jpg** key (UPDATE objects.new_key + content_type in state.db if
the ext differs), generate+PUT the 3 webp variants, record `variants` rows + mark `copied` with
the new bytes. Fallback for the truncated JPEG if lh3 also fails: `sharp(bytes, { failOn:
'none' })` on the mirror bytes. Result: every photo original in R2 is a standard format (jpeg/
png/webp/gif) — no HEIC ever lands in the bucket.

**CONCURRENT SESSION WARNING**: session 019f8e34… ("helpers-folder migration") is actively
dissolving `site/src/lib/helpers/` in the SAME working tree — dev-server SSR was broken mid-move
(`$lib/helpers/orthographies` gone). Before running e2e/checks, wait for it to finish
(`python3 ~/code/horse/scripts/find-sessions.py ~/code/living-dictionaries | head` — wait until
only YOUR session is running). Their moves touched files I also edited (contributors/+page.ts
imports) — merge state should be fine, but re-run tsc/lint/check/vitest after they land.

**Remaining sequence** (all pieces already built — see build log above):
1. Copy finishes + fix the 3 error photos → `pnpm tsx media-migration/verify.ts` (checks
   originals + variants; only dicts with photo objects re-verify).
2. Helpers session done → full checks: `pnpm tsc`, `pnpm lint` (repo root), `pnpm check`,
   `pnpm vitest run`, then `pnpm test:media` (rewritten e2e: vite dev on :3105, asserts
   R2-convention keys + real sharp variants in `.data/dev-media/achi/photo/`). NOTE the e2e
   currently FAILS due to the helpers-session breakage (entry page 500/404) — it should pass
   once their tree is consistent; if not, debug with `pnpm dev --port 3105` + curl.
3. Optionally screenshot /admin/storage in dev (dev-auth skill, admin level 3 cookie).
4. Tell Jacob: ready to commit+push (deploy). HE pushes. Verify deployed commit on living
   (`ssh living 'cd /opt/hosting/sveltekit/code && git log --oneline -1'`), containers healthy.
5. `pnpm tsx media-migration/rewrite.ts --confirm-dual-read-deployed` (canary a small photo dict
   first, e.g. `--dict=<pick one with ~1-5 photos>`, spot-check photo_src urls serve 200 from
   media.livingdictionaries.app incl. _thumb.webp, then full run). Verify prod: photos rows new
   paths, partner logos + featured_image JSON updated, featured_entries.photo_storage_path
   backfilled, snapshot builder churning, /admin telemetry quiet (check-logs skill).
6. `pnpm tsx media-migration/seed-ledger.ts` (needs deployed schema = migration 20260723a).
   Then spot-check /api/admin/storage on prod (admin session) + the sweep cron log line.
7. Post-flip sweep: re-run pull-manifest.ts + pull-manifest-photos.ts → copy → verify → rewrite
   (catches GCS-window uploads; expect ~zero).
8. Re-run the LD backup-media leg 4 manually (see vps-setup bin/backup-media) so photos land in
   the locked mirror; verify counts vs media bucket.
9. vps-setup: DROP the `living` GCS leg from bin/backup-media (house stays), update its header +
   `.knowledge/operations/r2-backup-system.md`. Jacob commits vps-setup when told.
10. Docs: AGENTS.md media bullet (photos now on R2 too; lh3 only as legacy failsafe),
    `.knowledge/domain/media-serving-urls.md`, issue wrap-up, `.knowledge` entry for the media
    ledger/sweep architecture if warranted. DON'T commit LD repo — Jacob does.

## Continuation session progress (2026-07-23, mustang — session 63437eca)

- ✅ **Photo copy COMPLETE**: 21,800 objects copied (12.6 GB), 0 missing, 0 remaining errors.
  Sources: 21,662 mirror + 100 gcs + 38 repaired.
- ✅ **38 stuck photos repaired** via new `scripts/media-migration/fix-error-photos.ts` (Jacob's
  "no HEIC in the bucket" directive): 22 VERBATIM (valid JPEGs sharp only rejected on a strict
  failOn warning — Invalid SOS/ASCII — stored original bytes untouched, no lossy re-encode) + 16
  TRANSCODED (13 HEIC iref-limit + gain-map + 1 truncated JPEG → lh3 `=s0` clean JPEG, or mirror
  bytes with failOn:none+unlimited fallback; stored under `.jpg` keys, state.db new_key updated).
  Script branches on the recorded error string (`heif|bad seek|premature end|corrupt header` →
  transcode, else verbatim). Idempotent (only status='error' rows). Spot-checked repaired HEIC:
  serves 200 image/jpeg + _thumb.webp 200 image/webp from media.livingdictionaries.app.
- ✅ **verify.ts: 298 dicts clean, 0 problems** (every photo original + 3 variants present, exact
  bytes).
- ✅ **Tree checks green** (after helpers-migration session finished — only our session runs now):
  tsc clean, lint clean, svelte-check 0 errors, full vitest green. Fixed 2 STALE tests in
  `upload-media.test.ts` (missing the `file_size` field the Phase-2 flip added to the presign call).
- ✅ **Direct server verification of the photo-upload path** (curl against `vite dev`, achi-manager
  OTP login): POST `/api/photo-upload` → 200, R2-convention `storage_path` (`achi/photo/{uuid}.png`),
  original stored + all 3 WebP variants generated by the background sharp pipeline. Realistic-image
  variant pipeline proven (png+jpg, all 3 sizes). Migration code is SOUND.
- ✅ **Fixed a real e2e bug**: `e2e/media-upload.mjs` used a 1x1 `REAL_PNG` that trips
  `vipspng: libpng read error` in the cover-resize → replaced with a 24x24 PNG. (Nothing to do with
  the upload path; a 1x1 image is just a degenerate test input.)
- ⚠️ **KNOWN mustang ENV ISSUE (not a code regression, blocks only the browser e2e here)**:
  `site/.data/dictionaries/achi.db` on mustang is a REAL Achi dictionary (487 entries, zero `e_*`),
  NOT the e2e fixture (13 `e_*` entries incl. `e_ja`/"water"). So `/achi/entry/e_ja` 404s and
  `pnpm test:media` can't complete the browser leg here. The previous session's handoff mis-blamed
  the helpers session for this "entry page 500/404". achi.db is gitignored with no canonical copy on
  mustang; the legacy content reseed was retired. **Run `pnpm test:media` on tuf** (fixture intact),
  or restore `.data/dictionaries/achi.db` from tuf/the example repo. The server-side upload path is
  fully verified via the direct curl test above regardless.
- ⏭️ **READY for Jacob to commit+push the photo-migration deploy.** Tree also contains the completed
  helpers-folder migration (separate task) — decide whether to split commits. After deploy: rewrite
  --confirm-dual-read-deployed → seed-ledger → post-flip sweep → LD backup leg → drop GCS leg → docs.
- ⏭️ HEIC-upload + EXIF-coords features (below) build AFTER this deploy as a separate follow-up
  deploy (keeps the tested migration deploy clean).

## Phase 2b: HEIC-upload handling + photo EXIF coordinates (Jacob 2026-07-23, this session — NOT YET BUILT)

Two additive features, layered onto the Phase-2 photo flip code. Build alongside the migration
finish; they don't block the flip. All four sub-decisions locked with Jacob.

**Findings that drove the design:**
- npm prebuilt `sharp` (site: 0.34 / libvips 8.18 / libheif 1.23) DOES bundle HEVC decode, but real
  iPhone HEICs routinely trip libheif's **iref-16 security limit** (migration's stuck photos have
  36–48 refs — HDR/Live-Photo gain-map images). `{ unlimited: true }` clears that limit but then
  hits `bad seek` on the gain-map data → server HEIC decode is UNRELIABLE for exactly the photos we
  care about. Verified by decoding a real prod HEIC both in site/ and scripts/ sharp.
- Safari decodes HEIC natively (that's where HEIC comes from — iPhones) → browser canvas conversion
  is strictly more robust than server-side.
- Canvas conversion strips ALL EXIF (incl. GPS); sharp strips EXIF from WebP variants too → can't
  rely on preserving the embedded blob. Extract to structured columns instead.

**Decisions:**
1. **HEIC upload (browser)** = `client_plus_net`: in `upload-media.ts` image branch, if file is
   `image/heic`/`image/heif` (type or extension), convert to JPEG via `createImageBitmap(file)` →
   `<canvas>` → `canvas.toBlob(…, 'image/jpeg', 0.9)` BEFORE upload (Safari native decode). Server
   `/api/photo-upload` net: read `sharp(bytes).metadata()`; if format not web-displayable, try one
   `sharp(bytes, { unlimited:true }).rotate().jpeg()`, else reject with a clear message (never store
   a broken original).
2. **HEIC via v1 API (agents)** = reject, don't attempt. Sniff incoming bytes by MAGIC NUMBER
   (ftyp…heic/heif/mif1 — not the claimed extension) in `store_media_bytes`/v1 media handler →
   return **415** with actionable body: `{ error:'unsupported_image_format', format, message, hint }`
   where hint lists `sips -s format jpeg`, `magick in.heic out.jpg`, `heif-convert`. Document in
   `openapi.json` + the `/api/v1/guides` import guide.
3. **Photo EXIF coordinates**: add to `photos` table (dict-migration) — `latitude REAL`,
   `longitude REAL`, `taken_at TEXT` (all nullable). Extract with **exifr** (new dep; tiny,
   tree-shakeable, works browser+node, parses HEIC EXIF+GPS): browser reads GPS from the RAW file
   BEFORE canvas conversion → sends lat/lng/taken_at as form fields; v1 API reads server-side from
   received original bytes. Store structured, not the embedded blob (survives canvas/variant strip).
   Thread through add_photo, photo-upload, v1 media write, guarded-writes, types.
4. **Geoprivacy**: BLUNT ON INGEST — round lat/lng to **2 decimal places (~1.1 km, village-level)**
   before storing; the house-level coord NEVER touches DB/backups/R2. **No scoot/jitter** (the grid
   cell IS the ~1 km privacy envelope). De-stack markers visually at render time if the map looks
   gridded (deterministic photo-id-seeded cosmetic offset only if needed — skip initially). UI: show
   coords on photo/map, easy per-photo clear for managers (`capture_show_optional`).

## Final decisions (Jacob 2026-07-23, second round)

- **Backup bucket**: `livingdictionaries-backups`, `media/` prefix — 1-year per-object lock, NO
  lifecycle expiry, add-only mirror (deleted-at-source retained). Same model as poly's gcs mirror.
- **Backup creds**: runtime pull over fleet SSH from living's env (app R2 token is account-wide
  Object R/W) — ephemeral env-only rclone remote, zero new stored secrets.
- **Sequencing**: audio+video end-to-end first (copy → rewrites → serving+upload flip → backup
  leg); photos second pass once sharp variant pipeline exists.
- **Uploads**: keep browser presigned-PUT, now against R2, same `/api/upload` shape, new keys.
- **Mid-migration upload safety** (Jacob's requirement — no stranded uploads):
  1. upload URLs are server-issued per request → stale clients automatically follow the flip;
  2. dual-read serving: new-convention keys → media.livingdictionaries.app, old-convention keys →
     GCS/lh3 fallback (GCS keeps serving throughout);
  3. driver is idempotent + a POST-FLIP SWEEP re-scans all dicts for rows with old-style paths
     (uploads that landed on GCS during the window) and migrates them.
- **Fat cleanup approved**: delete legacy `cache` + `search-index` buckets on the LD account
  (Firebase/Vercel-era). Method: verify zero code references → whole-bucket lifecycle expiry rule
  (R2 deletes internally, free) → delete empty buckets. LD `backup` bucket (supabase_sql, 5.3GB)
  NOT in scope — ask separately.
- Billing-widget detail (account + expanded line items) still awaited from Jacob — not blocking.

## Notes

- CF admin token: Jacob provided in-session 2026-07-23 (cfut_…) — user-scoped, works on all three
  accounts for R2 bucket admin + GraphQL analytics. NOT stored anywhere; ask Jacob if needed again.
- LD app R2 creds (`R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY` in living's
  `/opt/hosting/sveltekit/.env`) are account-wide Object R/W — can read/write all LD-account
  buckets incl. the future media bucket.
- LD-account bucket inventory: backup (5.3GB, supabase_sql — legacy), cache (entries_data — huge,
  legacy, listing times out), search-index (huge, legacy), livingdictionaries-snapshots (~1.3k
  dbs), livingdictionaries-attachments. cache + search-index are Firebase/Vercel-era leftovers —
  candidates for deletion in a separate cleanup (they're Standard class, just storage cost).
