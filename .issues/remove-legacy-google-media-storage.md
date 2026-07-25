# Remove legacy Google media storage

## Goal

Audit every remaining reference or dependency related to Google Cloud Storage and Firebase Storage
now that R2 is the sole media store. Classify each finding and recommend removal, replacement, or
historical archival treatment.

**Implementation authorized 2026-07-24:** complete the cleanup end-to-end, including deleting the
dead test audio row and moving site-level images/default SEO media off Google hosting. Final
infrastructure deletion remains ordered after the R2-only deploy and verification.

**Deferred teardown:** GCS bucket/credential deletion waits one month. Horse cron job `c-638092`
runs 2026-08-24 at 09:00 on mustang to verify the deployed R2-only state, zero old paths, backup
parity, and any stale-client writes; it must report to Jacob and wait for explicit confirmation
before destructive teardown.

## Audit checklist

- [x] Runtime media URL construction and fallback behavior
- [x] Upload, delete, migration, and cleanup paths
- [x] Environment variables, packages, deploy configuration, and scripts
- [x] Tests, fixtures, schemas, and stored path conventions
- [x] Active docs, knowledge, issue files, and agent instructions
- [x] Confirm whether the future cleanup job is R2-only and identify any remaining Google coupling
- [x] Deliver a complete categorized inventory and recommendations

## Scope decision

R2 is the only supported media store. GCS and Firebase Storage are not intentional legacy
fallbacks. Historical facts may remain only where they are clearly archival and cannot be mistaken
for current architecture or required infrastructure.

Design decisions from Jacob:

- ✅ Store site-owned images in versioned R2 `site/<asset>/<content-hash>/` namespaces.
- ✅ Remove every legacy serving-url schema/API field in this cutover.
- ✅ Delete obsolete migration tooling and docs; git history is the archive.
- ✅ Prepare code and migrate safe live data, then stop at the deploy gate.
- ✅ Leave the GCS buckets and credentials untouched for one month pending the scheduled audit.

## Implementation progress

- ✅ Recovered the three About photos, Living Tongues partner logo, and generic SEO image while
  their Google-hosted sources still worked.
- ✅ Generated responsive WebP variants and a purpose-sized 1200×630 PNG share image.
- ✅ Uploaded and independently verified all 18 immutable objects under content-addressed R2
  `site/` keys, including MIME types and one-year immutable cache headers.
- ✅ Replaced the About, partner-logo, and default SEO URLs with central `SITE_MEDIA` constants.
- ✅ Removed the unused OG preview component and the OG renderer's `gcsPath`/lh3 path.
- ✅ Fixed `vps-setup/bin/backup-vps-db` so Living backups include
  `dictionaries/*.db`; uploaded and stream-verified a backup containing `shared.db` plus all 1,385
  dictionary DBs before live mutations.
- ✅ Migrated the one live GCS-only cover to an R2 original plus three variants, ledgered all four
  objects, updated the catalog row, and verified the public objects.
- ✅ Backfilled all 198 featured-entry audio snapshots from authoritative dict rows; all 147
  approved homepage cards now use R2 audio paths.
- ✅ Removed all 85 `serving_url` keys from live catalog `featured_image` JSON.
- ✅ Refreshed the baked homepage seed after the production backfill; all 147 cards carry R2 photo
  and audio paths and no removed fields.
- ✅ Tombstoned the dead test audio row and verified its durable server-sequence tombstone.
- ✅ Removed runtime GCS/Firebase/lh3 upload and URL paths, the GCS client, and the serving-hash
  endpoint. Stale folder-shaped uploads now receive 410.
- ✅ Added forward migrations dropping `photos.serving_url`,
  `dictionary_partners.photo_serving_url`, and `featured_entries.photo_serving_url`; removed them
  from Drizzle, read models, writes, OpenAPI, fixtures, and exports. Applied migrations remain
  immutable as the only historical schema record.
- ✅ Deleted the completed media migration driver/issue and legacy GCS upload knowledge page; git
  history is the archive.
- ✅ Rewrote current architecture guidance and stale fixtures as R2-only, removed old analytics
  examples and migration-era mocks, and replaced the image-serving size syntax with explicit R2
  variants (`thumb`, `w900`, `w1600`, `original`).
- ✅ Removed the obsolete local `PUBLIC_STORAGE_BUCKET`; verified SSR HTML and browser requests
  contain no Google-media configuration or URL.
- ✅ Verified 1,966 tests across 277 files, zero `svelte-check` errors, clean ESLint, a successful
  production build, Svelte-analyzed changed components, and headless-browser renders of the
  homepage/About page with zero Google-media requests or runtime page errors.
- ✅ Visually inspected the homepage and all three About images; directly fetched the R2 SEO
  image, an About variant, and the migrated catalog cover variant (200, correct MIME, immutable
  one-year cache headers).
- ✅ Passed the real browser media-upload flow: photo POST, three background WebP variants, audio
  presign/PUT, SQLite sync, and a fresh-browser render all use R2-convention keys.
- ✅ Re-scanned all 1,280 production dictionary DBs: 146,726 audio rows, 21,653 photos, and 187
  uploaded videos have zero invalid/non-R2 paths. All 198 featured snapshots, 85 covers, and 78
  partner photos likewise have valid R2 paths; covers contain no removed URL hash.
- ✅ The dead test row's authoritative DB tombstone is correct. Its public snapshot predated the
  content-cursor system and had not rebuilt since 2026-07-09, so only that dictionary's catalog
  mirror timestamp was advanced to the tombstone time. The normal 30-minute R2 builder regenerated
  the snapshot at 2026-07-24T10:55:12Z; the public object has the matching new Last-Modified value
  and contains zero copies of the dead audio row. The authoritative snapshot queue is back to zero.
- ✅ Completed final production snapshot verification and stopped before deployment.
- ✅ Confirmed commit `bfcd4bd3` deployed, removed `PUBLIC_STORAGE_BUCKET` and
  `PROCESS_IMAGE_URL` from both live VPS env copies, and force-recreated green then blue behind
  health gates. Both containers have zero obsolete variables and still have the two deferred
  private HMAC credentials. External verification: homepage and `/healthz` return 200, the removed
  `/api/gcs_serving_url` returns 404, homepage HTML contains no legacy media reference, and the
  R2 default SEO asset returns 200 with its immutable one-year cache policy.
- ⏳ Remove the same two variables from the canonical tuf file
  `vps-setup/secrets-decrypted/sveltekit-living.env`, then run
  `bin/sync living --env-only`. This only prevents a future sync from restoring them; the active
  containers are already clean.

## Audit result — 2026-07-24 (historical baseline, resolved above)

At the start of this task, normal per-dictionary media had been copied to R2, but live code still
accepted old paths, production retained old credentials/configuration, and a stale client had
written one new cover after the migration rewrite. The implementation checklist above records the
resolution; this section preserves the evidence that drove it.

### Production data

Read-only scan of all 1,280 production `dictionaries/*.db` files:

| Table | Total | R2 paths | old paths | empty path | nonempty legacy lh3 hash |
|---|---:|---:|---:|---:|---:|
| `audio` | 146,727 | 146,726 | 1 | 0 | — |
| `photos` | 21,653 | 21,653 | 0 | 0 | 21,636 |
| `videos` | 427 | 187 | 0 | 240 hosted-only | — |

- The one old audio row is the already-known dead test object in dictionary
  `QAThAUaCXUaJVLwZeXEz`, row `74e1aa3a-f9b8-40ae-ae60-cb3088a8736e`. Its Firebase URL returns
  404. Recommendation: delete the dead row via a sync tombstone.
- `dictionaries.featured_image` has **84 R2 covers and one GCS-only cover**:
  `llustrated-thematic-dicti/featured_images/1784817126968.jpeg`. It was uploaded at
  2026-07-23T14:32:06Z, about 3.5 hours after the full photo rewrite completed. Both the Firebase
  URL and lh3 URL still return 200. Recommendation: copy it to a new
  `{dict}/photo/{uuid}.jpeg` R2 key, generate variants, ledger it, and update the catalog JSON
  before removing fallback code.
- All **198** `shared.db.featured_entries.audio_storage_path` snapshots are old paths, while every
  referenced source audio row (matched by `dict_id + audio_id`) exists and has an R2 path.
  Recommendation: deterministically backfill all 198 snapshots from the source rows. The 147
  approved cards currently exported to the live homepage all use old audio paths, so the homepage
  is still actively served by Firebase Storage today.
- The live homepage export has 147 R2 photo paths, but also 147 redundant lh3 hashes. The committed
  `homepage-baked.json` seed predates the photo rewrite: it has 147 old audio paths, zero photo
  storage paths, and 147 lh3 hashes. Recommendation: backfill shared data first, refresh the
  committed seed, and deploy so the production bake contains R2-only paths.
- Redundant fallback hashes remain in 21,636 photo rows, 78 partner rows, 198 homepage-featured
  rows, and 85 cover-image JSON values. They are not needed once storage paths are authoritative.
  Before clearing/dropping them, fix `contributors/+page.server.ts`, which currently creates a
  partner photo only when `photo_serving_url` is truthy even if `photo_storage_path` is present.

### Live runtime code

1. **Serving fallback**
   - `site/src/lib/utils/media-url.ts` sends non-R2 paths to
     `firebasestorage.googleapis.com` and photos without a recognized R2 path to lh3.
   - `url_from_storage_path` unnecessarily takes `PUBLIC_STORAGE_BUCKET`; `image_src`,
     `DEV_LOCAL_PREFIX`, and the legacy half of `photo_src` exist only for lh3/dev-sentinel
     compatibility.
   - `site/src/lib/utils/media-path.ts` and tests explicitly model/reject old GCS key shapes.
   - Recommendation: make storage-path URLs unconditionally R2 (dev remains `/api/dev-media`),
     make photos storage-path-only, remove the bucket argument and legacy helpers/tests.

2. **Legacy upload/write path**
   - `site/src/routes/api/upload/+server.ts` still accepts an old `folder` request and presigns a
     public-read GCS PUT. This is how a stale browser could create the post-migration cover.
   - `site/src/lib/server/media-storage.ts` still has a no-`r2_key` GCS write branch plus
     `resolve_photo_serving_url` / `fetch_serving_url`.
   - `site/src/lib/server/gcloud.ts` is the GCS S3-interop client.
   - Current callers of `store_media_bytes` all supply `r2_key`; the legacy functions have no
     current caller.
   - Recommendation: delete the GCS branch and `gcloud.ts`. For stale `folder` requests, return an
     explicit upgrade-required error instead of silently accepting GCS writes.

3. **Dead App Engine endpoint**
   - `site/src/routes/api/gcs_serving_url/{+server.ts,_call.ts,server.test.ts}` still exposes the
     lh3 hash service. No current client calls `_call.ts`.
   - Recommendation: delete the route, call wrapper, tests, telemetry name, and related
     `PROCESS_IMAGE_URL` logic.

4. **Static bucket plumbing**
   - `PUBLIC_STORAGE_BUCKET` is imported by the dictionary layout, home/gallery cards, homepage
     word cards/fullscreen, admin featured-word review, and the v1 media redirect route; the mock
     env also defines the dev bucket.
   - Recommendation: remove every import and simplify the builder to one argument. The v1
     authenticated download endpoint should redirect straight to
     `https://media.livingdictionaries.app/{storage_path}` after validating the row.

5. **SEO/OG and schema.org**
   - `SeoMetaTags.svelte`, `LoadOgImage.svelte`, `OpenGraphImage.svelte`, and `/og/+server.ts`
     carry `gcsPath` and construct lh3 URLs.
   - The generic SEO fallback image is hard-coded to Firebase Storage.
   - Entry JSON-LD currently emits the raw `serving_url` hash as `image`, not a usable URL.
   - Recommendation: use only absolute R2 URLs (`photo_src`) in OG and JSON-LD, remove `gcsPath`,
     and move the generic logo to a repo-owned static asset.

6. **Hard-coded Google-hosted assets**
   - `contributors/Partners.svelte`: one Living Tongues logo on Firebase Storage.
   - `about/AboutContent.svelte`: three photos and their srcsets on lh3.
   - `SeoMetaTags.svelte`: one Firebase default-share logo.
   - Recommendation: fetch originals while they still work, optimize responsive variants, and
     commit these site-owned assets under `site/static/` (better fit than user-media R2).

### Schema/API/type residue

- `photos.serving_url TEXT NOT NULL` is in the dict schema and initial migration.
- `dictionary_partners.photo_serving_url`,
  `featured_entries.photo_serving_url`, and `FeaturedImage.serving_url` mirror it in shared data.
- The v1 media read/write layer and OpenAPI expose `serving_url` as an lh3 hash.
- Homepage card types, entry read models, partner types, history labels, curation SQL, and many
  components still carry the values.
- `site/src/lib/types/photo.interface.ts` is an unused exported legacy type containing
  `fb_storage_path` and `specifiable_image_url`; the print type has a `pf.gcs` comment.
- Recommendation: after the data backfills and R2-only read code land, add proper shared/dict
  migrations to drop the serving-url columns, update API/OpenAPI/read models, remove the unused
  legacy types, and remove `serving_url` from cover JSON. Do not rewrite applied initial
  migrations; create drop migrations and let a future migration squash erase historical SQL.

### Tests, mocks, telemetry, and agent-facing guidance

- GCS-specific tests/mocks exist beside `/api/upload`, `/api/gcs_serving_url`, media URL helpers,
  OG rendering, markdown round-tripping, analytics mock data, print mock data, and
  `env-static-public.ts`.
- Triage examples/stories still tell agents that media resolves through GCS/lh3.
- `.claude/commands/curate-featured-words.md` explicitly builds lh3 contact sheets and tells Jacob
  to listen through Firebase URLs.
- `.claude/skills/database/SKILL.md` says storage paths resolve to GCS/lh3.
- Recommendation: rewrite functional tests for R2-only behavior, use neutral example URLs where a
  test only needs an external image, and update all agent instructions. Google-auth tests using
  lh3 **avatar URLs** are unrelated to media storage and should remain.

### Docs and completed migration tooling (historical finding, resolved)

At audit time, agent-visible docs explicitly preserved GCS as a fallback:

- `AGENTS.md`
- `.knowledge/domain/media-serving-urls.md` plus domain/root indexes
- `.knowledge/db/media-upload.md` plus DB index
- `.knowledge/shared-stack-conventions.md`
- `.knowledge/domain/secure-dictionary-mode.md`
- `.knowledge/api/v1-write-api.md`
- several active `.issues/*.md` and historical `.cron/log-reviews/*.md`

The completed `scripts/media-migration/` directory contained the retired download code and old
backup paths.

Recommendation:

- Rewrite the durable media docs as R2-only and delete the obsolete GCS upload knowledge page.
- Update active issues and agent commands/skills so search cannot lead an agent back to the old
  architecture.
- Remove the completed migration driver after extracting any still-valuable R2 operational facts;
  git history remains the migration archive.
- Keep applied migration SQL immutable. Historical log reviews can either be removed or clearly
  marked obsolete, but must not remain discoverable as current advice.

### Production/infrastructure (remaining deploy + deferred teardown)

The living VPS still configures:

- `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID`
- `GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY`
- `PUBLIC_STORAGE_BUCKET`
- `PROCESS_IMAGE_URL` → `anet-photo.appspot.com/urlfull`

Required sequence after the R2-only deploy and data verification:

1. ✅ Removed `PUBLIC_STORAGE_BUCKET` and `PROCESS_IMAGE_URL` from the deployed VPS env and
   recreated both app containers. The former would be exposed by `$env/dynamic/public` if left.
   The matching canonical tuf edit and `bin/sync living --env-only` remain as the one local
   follow-up so a future sync cannot restore the variables.
2. Leave the private HMAC env entries and storage resources untouched for the one-month safety
   window.
3. At the scheduled 2026-08-24 audit, remove the private HMAC env entries, revoke the credentials,
   and delete both LD prod/dev storage buckets only after the final zero-old-path and
   R2/locked-backup parity checks pass and Jacob explicitly confirms.
4. Do **not** decommission `anet-photo.appspot.com` yet: the `house` repo actively uses the same
   proxy and remains on GCS. Remove only Living Dictionaries' dependency; App Engine teardown
   belongs to House's eventual R2 migration.
5. ✅ Removed Living references from the active `vps-setup/bin/backup-media` comments and backup
   knowledge; its remaining GCS leg is House-only.
6. The old poly R2 `backups-rolling/mirror/gcs-living/` is not live infrastructure and is
   redundant with `livingdictionaries-backups/media/`. Delete it when its retention allows (or
   deliberately remove the lock with admin authority), rather than carrying it as a permanent
   “failsafe.”

No Firebase or `@google-cloud/storage` package is installed in the main app. The AWS S3 packages
must remain because R2 uses them. `ids-import`'s transitive `googleapis` package is for the separate
Google Sheets Apps Script tooling, not media storage.

## Existing cleanup cron

The future media cleanup job already exists and is R2-only:

- `start_media_sweep_cron_once()` is registered in `hooks.server.ts`.
- It ticks hourly, writes the daily storage rollup, and performs a full R2 reconciliation every
  6.5 days.
- It marks unreferenced R2 objects orphaned, waits 30 days, then really deletes them (capped at
  5,000/run); the locked R2 backup retains originals for one year.
- Production last reconciled at `2026-07-23T11:47:35.958Z`; the ledger currently has 234,181
  objects and zero marked orphans, and the daily rollup is current through 2026-07-24.

Recommendation: keep this cron. Remove only its stale “legacy GCS paths are ignored” comment after
old rows are eliminated. GCS teardown itself should be a one-time checked operation, not another
recurring cron.

## Recommended implementation order

1. Migrate the one GCS-only cover, backfill all 198 featured-audio snapshots, and tombstone the dead
   test audio row.
2. Refresh the committed homepage seed and verify the live export contains only R2 paths.
3. Move the five hard-coded site assets off Firebase/lh3.
4. Land R2-only serving/upload/API/OG code and remove the GCS endpoint/client/static env plumbing.
5. Drop/scrub the legacy serving-url fields and update all types, OpenAPI, curation, partner, and
   JSON-LD code.
6. Update agent docs/skills/issues; delete completed migration tooling.
7. Deploy, verify browser media/export/upload/OG flows and run a production zero-old-path query.
8. Remove production/canonical env vars and revoke HMAC keys.
9. Verify R2 + locked R2 backup parity, then delete the LD GCS buckets. Leave the shared App Engine
   proxy until House migrates.

## Deploy gate

Do not deploy, remove living production env variables, revoke HMAC credentials, or delete any GCS
object/bucket in this task without a new explicit instruction from Jacob.
