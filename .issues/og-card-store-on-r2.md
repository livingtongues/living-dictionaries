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

### Questions put to Jacob (recommendation in bold; update this section with his answers)

| # | question | recommendation |
|---|---|---|
| 1 | disk hot tier, or R2 only? | **keep disk as hot tier** — 13–26 ms, already tested, and the only tier that still serves during an R2 outage |
| 2 | which bucket? | **new dedicated `livingdictionaries-og-cache`** — invisible to `backup-media`, invisible to the weekly media sweep, own expiry rule |
| 3 | read transport? | **signed `GetObject`** (~280 ms, one code path); public-CDN reads (~10 ms) are a later one-line upgrade if the tail shows up in telemetry |
| 4 | disk tier size? | **~5,000 cards / 1 GB** (1.3% of free disk) |
| 5 | add `og_card_served {source}` telemetry now? | **yes, minimal** — hits are invisible today, so there is no way to prove tomorrow that R2 is serving |
| 6 | lifecycle expiry? | **90 days** |

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

### Jacob's provisioning steps (blocked on his admin `cfut_` token — the app token cannot create buckets)

1. Create R2 bucket `livingdictionaries-og-cache` (same LD account).
2. Lifecycle rule: delete objects at age 90 d.
   `PUT /accounts/{acct}/r2/buckets/livingdictionaries-og-cache/lifecycle` —
   `{id, enabled, conditions:{prefix:""}, deleteObjectsTransition:{condition:{type:"Age", maxAge:7776000}}}`
   (a `PUT` replaces the whole config; keep the standard `abortMultipartUploadsTransition` rule).
3. **No bucket lock, no backup wiring** — deliberately.
4. Nothing else. No env var, no CORS (server-side reads only), no custom domain unless we later take
   the CDN read path.

---

## Work

- [ ] `site/src/lib/server/r2-og-cache.ts` — client + `og_cache_is_configured()`, mirroring
      `r2-media.ts` (singleton, `reset_*_client()` test hook, bucket name from `$lib/constants.ts`).
- [ ] `site/src/routes/og/card-store-remote.ts` — `read_remote_card` / `write_remote_card`, timeouts,
      circuit breaker, negative cache. Every path fail-open.
- [ ] `site/src/routes/og/card-store.ts` — keep `card_key` / disk read / disk save / prune. Split the
      sync disk read (`read_local_card`, used by the shed path) from a new async
      `read_stored_card()` = disk → R2 → null, which on an R2 hit **back-fills the disk tier** so the
      next hit is local. `save_card()` writes disk sync + schedules the R2 PUT.
- [ ] `site/src/routes/og/+server.ts` — `await read_stored_card(key)` on the hot path; the R2 read
      happens **outside** the render queue slot (it is I/O, not CPU, and it must be allowed to turn a
      would-be *shed* into a real card). `degraded_response()` stays sync on memory+disk.
- [ ] Telemetry: `og_card_served` with `source: 'disk' | 'r2' | 'render'`, coalesced through the
      existing `og-telemetry.ts` 60 s bucket (counts only, no per-request rows).
- [ ] Tests — extend the existing inline suite in `card-store.ts` and `server.test.ts`:
      - a disk miss + R2 hit serves the card, **back-fills disk**, and does NOT render
      - an R2 fault / missing creds / `NoSuchKey` / timeout is a **miss**, never a throw
      - the PUT is not awaited by the response, and a failed PUT doesn't fail the response
      - the circuit breaker stops calling R2 after N faults and recovers after M ms
      - the shed path still answers from memory/disk with **zero** awaits on R2
      - the existing prune/LRU/`card_key` assertions keep passing (caps still enforced)
- [ ] Gates: `npx vitest run`, `tsc`/`pnpm check`, `eslint` on touched files.

## Verification plan

- Unit + route tests above (the store's real behaviour, not just its arithmetic).
- Local `node build` boot: cold store → one render → delete the disk file → confirm the second
  request is served **from R2** with no render (this is the whole point, and it's observable in
  `og_card_served.source`).
- Post-deploy, from mustang: fetch a fresh entry card twice and watch `og_card_served` sources; then
  `ls /opt/hosting/data/og-cache | wc -l` should stop being pinned at the cap while
  `og_render_shed` collapses. Re-measure `og_card_rendered` / `og_render_shed` on the next log review.

## Notes

- **house holds byte-identical constants** at `house/site/src/lib/server/satori/card-store.ts:44-45`
  and is a latent instance of the same fault (its card space — chapters + entities — is smaller, so
  it isn't symptomatic yet). NOT touched by this work. Portability assessment goes in the report.
- Working tree was already dirty from another lane (parity sweep) plus a failing
  `cron-scheduler.test.ts`; neither is ours to fix.
</content>
</invoke>
