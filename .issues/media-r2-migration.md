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
- ⏳ NEXT: copy finishes → `verify.ts` → commit+push flip (deploy) → `rewrite.ts
  --confirm-dual-read-deployed` → spot-check entries → update AGENTS.md media bullet + vps-setup
  backup leg (phase 6).

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
