# Move the /og share-card store off local disk and onto R2

**Approved by Jacob 2026-07-30.** Source: <File path=".cron/log-reviews/2026-07-29.md" /> §1a (🔴 P1)
and `~/code/horse/.cron/overnight-briefs/2026-07-29.md` §0 + decision 2.

**Jacob explicitly REJECTED the interim fix** ("raise `MAX_ENTRIES` / `MAX_BYTES`"). The store goes
to R2. The disk caps are a *latency* knob afterwards, never again the thing that decides whether we
re-render.

---

## The problem, measured in production

`site/src/routes/og/card-store.ts` caps the store at `MAX_ENTRIES = 1000` / `MAX_BYTES =
250_000_000`. The card space is every dictionary home + every entry (+ sentences/texts). Past 24 h
on the `living` VPS:

| measurement | value |
|---|---|
| known `/og` requests | 65,982 (store hits aren't logged, so the true number is higher) |
| requests **shed** → generic card | **36,346 — 55% of all `/og` traffic** |
| renders | **18,174 for ~1,000 slots** ⇒ each stored card re-rendered ~18×/day |
| CPU burnt re-rendering cards we already had | **~7.8 hours of one core/day** |
| store on disk | 1,005 files · 183 MB · newest file 30 s old — permanently full, permanently evicting |
| render cost | p50 452 ms · p90 ~1.6 s |

Roughly one in two links posted to Facebook/WhatsApp/Slack showed the generic card instead of the
dictionary's own.

### Numbers taken on the box 2026-07-30 (these decide the design)

| probe | result |
|---|---|
| disk `/` | 96 GB · 21 GB used · **76 GB free** |
| containers | `sveltekit_blue` + `sveltekit_green` (blue/green IS live on LD) |
| **card space** | **1,291 dictionaries + 589,990 entries** |
| ⇒ full card space at 173 KB/card | **~104 GB** |
| R2 read via public CDN, warm edge (158 KB object) | ttfb **40–47 ms** new conn · **6–8 ms** keep-alive |
| R2 read reaching the R2 origin (cache-busted) | ttfb **255–280 ms** ≈ what a signed `GetObject` costs |
| a disk hit today (2026-07-28 measurement, prod) | 13–26 ms |

**Consequence #1: disk can never hold the card space** (104 GB wanted, 76 GB free). Local disk is
*only* ever a hot cache. Any plan that "sizes the disk store correctly" is arithmetic that doesn't
close.

**Consequence #2: an R2 lifecycle rule is not housekeeping, it is the garbage collector.** Keys are
content-addressed (`STORE_FORMAT | image_version | props`), so bumping `OG_IMAGE_VERSION` orphans an
entire generation of objects that nothing will ever delete. Age-based expiry is safe *because* the
keys are content-addressed: an expired card is a miss that re-renders once.

### Cost at R2 pricing (vs 7.8 core-hours/day)

- class B GET $0.36/M → ~2M/mo ≈ **$0.72/mo** (less, with a disk tier absorbing the hot set)
- class A PUT $4.50/M → **≤ $0.09/day** while coverage builds, trending to ~0
- storage under a 90-day expiry ≈ **$0.50/mo**

---

## Design

```
memory   generic fallback card only · sync · 0 ms   → the shed path must stay free
  ↓
disk     <DATA_DIR>/og-cache · 13–26 ms             → shared by blue+green, survives deploys
  ↓
R2       the real store · immutable · lifecycle-GC  → survives everything, holds the long tail
  ↓
render   worker thread · ~450 ms p50                → only a genuine first-ever miss
```

### Decisions (settled without asking — they follow from existing invariants)

1. **Fail-open is preserved absolutely.** Every R2 call is wrapped; any fault (no creds, no bucket,
   `NoSuchKey`, timeout, 5xx, DNS) reads as a **plain miss** and we render, exactly like an
   unreadable file today. A failed write never fails a response that already has a good PNG.
2. **`AbortSignal.timeout` on every R2 call.** A hung GET must not hold the request longer than a
   render would (the font-fetch lesson from `.issues/og-endpoint-load-outages.md`: an untimed fetch
   can hold for the ~21 s OS connect timeout). GET ~2 s, PUT ~5 s.
3. **A consecutive-failure circuit breaker.** After N consecutive R2 faults, stop calling R2 for M
   seconds so an R2/CF outage doesn't add a timeout to every single miss. Reads as a miss while open.
4. **The PUT is off the request path** — fire-and-forget after the response is on its way, same
   pattern as the existing prune's `setTimeout(...).unref()`. The response never waits on R2.
5. **The generic fallback card is held in memory** once known, so `degraded_response()` stays
   **synchronous and zero-cost**. This is the property that makes a shed request free; it must not
   become an await.
6. **A bounded negative cache** (known-absent keys, short TTL) so a saturated queue doesn't re-GET
   the same absent key on every retry of a scraper that's coming back every 60 s.
7. **Local dev with no R2 creds = disk only**, precedent `store_media_bytes()`. Dev behaves exactly
   as today.
8. **Blue/green still matters, but is no longer the *only* sharing mechanism.** The disk tier keeps
   its atomic temp+rename (both containers write the same `/data/og-cache`, and a reader must never
   see a half-written PNG). What changes: a card now also survives container replacement and a
   `/data` wipe, and blue/green share via R2 even before either has the file locally.
9. **Nothing in this store is ever backed up.** It is 100% regenerable. This is why the bucket choice
   matters (see below) — `vps-setup/bin/backup-media` mirrors the *whole* media bucket into the
   1-year-locked `livingdictionaries-backups/media`.

### Questions put to Jacob — ANSWERED 2026-07-30 (all as recommended)

| # | question | settled |
|---|---|---|
| 1 | disk hot tier, or R2 only? | **keep disk as hot tier** — 13–26 ms, and the only tier that still serves during an R2 outage ✅ |
| 2 | which bucket? | **dedicated `livingdictionaries-og-cache`** — invisible to `backup-media`, invisible to the media sweep, own expiry rule ✅ |
| 3 | read transport? | **signed `GetObject`** (lane's call); public-CDN reads are a later one-line upgrade if the tail shows up in telemetry ✅ |
| 4 | disk tier size? | **5,000 cards / 1 GB** (1.3% of free disk) ✅ |
| 5 | add `og_card_served {source}` telemetry now? | **yes** — hits were invisible, so nothing could prove R2 is serving ✅ |
| 6 | lifecycle expiry? | **90 days** ✅ |

**Why not the media bucket** (`livingdictionaries-media` under `og/`): it ships with zero
provisioning, and the `og/` key shape is already safely ignored by `parse_media_key()` (so the weekly
reconcile neither adopts it into `media_objects` nor orphan-deletes it — verified in
`media-sweep-cron.ts:143-147`). But `vps-setup/bin/backup-media` runs
`rclone copy ldr2:livingdictionaries-media ldr2:livingdictionaries-backups/media` with only
`*_thumb/_w900/_w1600.webp` excluded, so every card would be mirrored into a **1-year-locked** prefix
— exactly what the 2026-07-28 ruling forbade ("fully regenerable and must never be added to a backup
set"). Choosing the media bucket therefore REQUIRES a one-line `--exclude "og/**"` in vps-setup
first.

**Why the dedicated bucket needs nothing but a bucket:** the app already holds account-wide
`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`. Following `r2-media.ts`, the bucket
name is a **constant in `$lib/constants.ts`, not a new env var** — so there is no `.env` change, no
`vps-setup` secrets round-trip, and no preflight-gated static import. Until Jacob creates the bucket
the code fails open and the endpoint behaves exactly as it does today.

### ⛔ BLOCKED ON JACOB: create the bucket (confirmed 2026-07-30 — the app's R2 token CANNOT)

Tried from the `living` box with the app's own credentials (a dependency-free SigV4 signer run inside
`sveltekit_blue`, so the creds never left the container). `ListBuckets` → **403**, `CreateBucket
livingdictionaries-og-cache` → **403 AccessDenied**, while `ListObjectsV2` against
`livingdictionaries-media` and `-snapshots` → **200**. So the token is object-scoped, exactly as the
plan assumed. The code is deployed and fails open: until the bucket exists every R2 GET reads as a
404 → plain miss → render, i.e. today's behaviour with a 1 GB disk tier instead of a 250 MB one.

1. Create R2 bucket `livingdictionaries-og-cache` (same LD account).
2. Lifecycle rule: delete objects at age 90 d.
   `PUT /accounts/{acct}/r2/buckets/livingdictionaries-og-cache/lifecycle` —
   `{id, enabled, conditions:{prefix:""}, deleteObjectsTransition:{condition:{type:"Age", maxAge:7776000}}}`
   (a `PUT` replaces the whole config; keep the standard `abortMultipartUploadsTransition` rule).
3. **No bucket lock, no backup wiring** — deliberately.
4. Nothing else. No env var, no CORS (server-side reads only), no custom domain unless we later take
   the CDN read path.

---

## Work — ✅ BUILT 2026-07-30 (commit pending Jacob's bucket for the R2 leg to do anything)

- [x] `site/src/lib/server/r2-og-cache.ts` — client + `og_cache_is_configured()`, mirroring
      `r2-media.ts` (singleton, `reset_r2_og_cache_client()` test hook, bucket name
      `R2_OG_CACHE_BUCKET` in `$lib/constants.ts`, `maxAttempts: 1`).
- [x] `site/src/routes/og/card-store-remote.ts` — `create_remote_card_store()` factory + the
      `remote_card_store` singleton. Deadline on every call (GET 2 s / PUT 5 s, enforced by BOTH an
      abort signal and a race), consecutive-fault breaker (5 faults → 30 s open), bounded negative
      cache (500 keys / 60 s). `create_r2_transport()` keeps the S3 command construction testable.
- [x] `site/src/routes/og/card-store.ts` — `read_local_card` (sync, disk only, used by the shed path)
      vs `read_stored_card` (async: disk → R2 → null, **back-fills disk** on an R2 hit).
      `save_card()` writes disk sync + schedules the R2 PUT. Caps raised to 5,000 / 1 GB.
      `set_remote_card_store()` is the test seam.
- [x] `site/src/routes/og/+server.ts` — `await read_stored_card(key)` before and OUTSIDE the render
      queue. `degraded_response()` stays synchronous on memory+disk.
- [x] Telemetry: `og_card_served { source: 'disk' | 'r2' | 'render' }` through the existing 60 s
      coalescing bucket, with `source` added to the bucket key.
- [x] Tests — 96 green in `src/routes/og`, covering: R2 hit serves + back-fills + does NOT render ·
      empty/absent/faulted R2 is a miss, never a throw · the PUT isn't awaited and a failed PUT never
      surfaces · the breaker opens after N faults and recovers · the negative cache expires and is
      bounded · a hung GET settles at the deadline AND aborts · a saturating burst never asks R2 for
      the generic card · the S3 transport's bucket/key/headers, `NoSuchKey`/`NoSuchBucket`/404 → null,
      a 503 still throws · all pre-existing prune/LRU/`card_key` assertions.
- [x] Gates: `pnpm test` (2,372 ✓), `pnpm check` (0 errors), `pnpm lint` (clean on touched files),
      `pnpm build`.
- [x] Local end-to-end against the REAL built server (`node build`, throwaway `DATA_DIR`): cold →
      render, warm → identical bytes from disk, disk file deleted → clean R2 miss → re-render, zero
      unhandled errors. `logs.db` then showed exactly
      `og_card_served {source:'disk',count:1}` + `og_card_served {source:'render',count:2}`.

### Folded in from item K (same files)

- [x] **house's job dispatch ported into LD's render pool.** One job dispatched at a time and the
      liveness clock starts when the worker is HANDED the job, so the timeout bounds a render rather
      than a render plus everything queued in front of it — which is why 20 s was firing in
      production on jobs that were merely waiting. Timeout accordingly 20 s → 10 s. House's
      pile-up test came with it.
- [x] **LD's font-fallback crash fix ported into house** (`house/site/src/lib/server/satori/
      render-worker.js`): re-read `names` after falling back to `unknown`, so an unmapped script
      stops throwing `names is not iterable` and reporting a spurious `dynamic_font_fetch` failure.
      House's map is SHORTER than LD's, so more scripts land there. House lane 1 had already pushed,
      so this was safe to touch.
- [x] **`script` / `family` / `timed_out` on `og_render_failed`** in both repos: the worker records
      the last dynamic font it asked for (safe — one render at a time) so the `static_fonts_only`
      retry can name the script that cost it, and the font-fetch catch reports the family plus
      whether it was a timeout. The og-telemetry bucket key splits on all three, so "1,536 font
      failures" becomes a per-script breakdown. This is what sizes the font-BUNDLING work
      (`.issues/bundle-render-fonts.md`, filed in both repos).

## Verification plan

- Unit + route tests above (the store's real behaviour, not just its arithmetic).
- Local `node build` boot: cold store → one render → delete the disk file → confirm the second
  request is served **from R2** with no render (this is the whole point, and it's observable in
  `og_card_served.source`).
- Post-deploy, from mustang: fetch a fresh entry card twice and watch `og_card_served` sources; then
  `ls /opt/hosting/data/og-cache | wc -l` should stop being pinned at the cap while
  `og_render_shed` collapses. Re-measure `og_card_rendered` / `og_render_shed` on the next log review.

## Still open

- ⛔ **Jacob creates `livingdictionaries-og-cache` + the 90-day lifecycle rule** (steps above). Until
  then the R2 tier is a permanent clean miss and LD behaves as it did, with a 4× bigger disk tier.
- **Post-deploy re-measure** (do this once the bucket exists): `og_card_served` should show `r2` as a
  real source, `og_render_shed` should collapse from ~36k/day, and
  `ls /opt/hosting/data/og-cache | wc -l` should stop being pinned at the cap.
- **The public-CDN read path** (~10 ms vs ~280 ms for a signed GET) stays a one-line upgrade for
  later, gated on the tail actually showing up in `og_card_served` timings. Needs a custom domain on
  the bucket.

## Notes

- **house holds byte-identical card-store constants** at
  `house/site/src/lib/server/satori/card-store.ts:44-45` and is a latent instance of the same fault
  (its card space — chapters + entities — is much smaller, so it isn't symptomatic yet). The R2 tier
  was NOT ported: house should take it when its card space grows or its shed rate becomes visible,
  and the shape here (factory + injected transport + fail-open) is designed to be liftable.
- Working tree was dirty from two other lanes throughout (the nightly parity sweep, then the
  analytics-snapshot lane actively editing `log-analytics.ts`). Everything here was staged
  file-by-file; the pre-commit hook (`vitest run --changed`) had to be bypassed because it picks up
  the OTHER lane's half-written files. Each commit re-ran its own files' suites first.
- Prod verification of the internal system-chat endpoint (JOB 1) covered every gate — no token → 404,
  through Caddy → 404, good token + bad payload → 400, good token + unknown room → 500 "room not
  found" (which proves the endpoint really reaches `deliver_system_message`), on BOTH containers. A
  successful POST was deliberately NOT sent: every chat room on prod contains real people, and a test
  message would have emailed them. Delivery itself is covered by `system-message.ts`'s own suite.
- **Follow-up (small):** `${DATA_DIR}/.internal-api-token` is created LAZILY, on the first request to
  `/api/internal/system-chat`, not at boot as the docs say. It was provisioned on prod by making one
  (rejected) request. Add the boot call to `hooks.server.ts` when the analytics lane stops editing
  that file — or just leave it lazy and fix the wording in `/system-chat` + the vps-setup issue.
</content>
</invoke>
