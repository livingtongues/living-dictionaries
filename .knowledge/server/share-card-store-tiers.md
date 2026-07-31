# The `/og` share-card store: why it is tiered, and what R2 can't do for us

Measured facts and rulings that the code can't tell you. The mechanics live in
`src/routes/og/card-store.ts`, `card-store-remote.ts` and `$lib/server/r2-og-cache.ts`; the plan and
its numbers are `.issues/og-card-store-on-r2.md` (git history).

## The card space is bigger than the disk, permanently

1,291 dictionaries + 589,990 entries, ~173 KB per card ⇒ **~104 GB of cards against 76 GB of free
disk on the `living` box** (measured 2026-07-30). There is no cap that makes local disk the store.
Any proposal that "sizes the disk store correctly" is arithmetic that doesn't close — the disk tier
is a latency cache and nothing else.

What being wrong about that cost, measured over 24 h on 2026-07-29 with a 1,000-entry cap:

| | |
|---|---|
| `/og` requests | 65,982 known (store hits weren't logged, so the truth is higher) |
| shed → generic card | **36,346 = 55%** |
| renders | 18,174 for 1,000 slots ⇒ each stored card re-rendered ~18×/day |
| CPU | ~7.8 core-hours/day re-drawing pictures we already had |

**Jacob explicitly REJECTED "raise MAX_ENTRIES / MAX_BYTES" as the fix.** The caps are a latency
knob; they must never again be the thing that decides whether we re-render.

## The app's R2 token cannot create buckets (verified, don't retry it)

Tested 2026-07-30 from inside `sveltekit_blue` with the app's own credentials:

| call | result |
|---|---|
| `ListObjectsV2` on `livingdictionaries-media` / `-snapshots` | **200** |
| `ListBuckets` | **403** |
| `CreateBucket livingdictionaries-og-cache` | **403 AccessDenied** |

So the credentials in `.env` are object-scoped. **Any new bucket is a Jacob task** (his admin `cfut_`
token), as is any bucket-level config — lifecycle rules included. Plan for it: ship code that fails
open and behaves exactly as before until the bucket appears.

Useful trick if you ever need a raw S3 call on the box: the container's `node_modules` has NO
`@aws-sdk` (it's bundled into the server build, not externalized), so `docker exec … node` can't
require it. A ~40-line dependency-free SigV4 signer piped over stdin works fine and reads the creds
from `process.env` inside the container — never from the `.env` file.

## Why a dedicated bucket and not a prefix in the media bucket

`vps-setup/bin/backup-media` runs `rclone copy ldr2:livingdictionaries-media
ldr2:livingdictionaries-backups/media` with only the WebP variants excluded, and that destination is
**1-year object-locked**. Share cards are 100% regenerable; the 2026-07-28 ruling forbids putting
regenerable bytes into a backup set. Using the media bucket would therefore have required a
`--exclude "og/**"` in vps-setup first. (The weekly media sweep is NOT the problem — `parse_media_key()`
already ignores foreign key shapes, so it neither adopts nor orphan-deletes them.)

Second-order consequence worth remembering: because card keys are **content-addressed**
(`STORE_FORMAT | image_version | props`), bumping `OG_IMAGE_VERSION` orphans an entire generation
that nothing will ever delete. **The lifecycle rule is the garbage collector, not housekeeping.**
Age-based expiry is safe precisely because the keys are content-addressed — an expired card is a miss
that re-renders once.

## Latency numbers behind the tier choice (measured 2026-07-30)

| path | ttfb |
|---|---|
| local disk hit | 13–26 ms |
| R2 via public CDN, warm edge | 40–47 ms cold conn · 6–8 ms keep-alive |
| R2 reaching origin (cache-busted) ≈ a signed `GetObject` | 255–280 ms |
| a render | p50 452 ms · p90 ~1.6 s |

We took the **signed `GetObject`** path: one code path, no custom domain, and still ~40% of a render.
The public-CDN read is a later one-line upgrade if the tail ever shows up in `og_card_served`.

## Two properties that must not be traded away

- **The shed path stays synchronous** (`read_local_card` + an in-memory fallback). A shed request
  being FREE is the entire justification for shedding; the moment it awaits a network call,
  saturation starts costing what saturation was declared to avoid.
- **Every R2 fault is a miss, never an error.** No creds, no bucket, `NoSuchKey`, timeout, 5xx, DNS —
  all of it renders, exactly as before R2 existed. A share endpoint that can be taken down by its own
  cache is worse than one with no cache.

## Telemetry: a card store with no hit rate looks healthy while thrashing

`/og` logged renders and failures but not store HITS, so its denominator was unknowable: a
"success rate as % of attempts" panel would have read **96%** on a night when **55% of shares served
the generic card**. `og_card_served { source: 'disk' | 'r2' | 'render' }` exists to make the honest
verdict computable — *share of `/og` requests answered with the dictionary's own card*. Standing
lesson, fleet-wide: **when you add a cache, add its hit counter in the same commit.**

Same shape one level down: `og_render_failed` carried no script/family, so "1,536 font failures/day"
was unactionable until it could be grouped — it turned out to be 97% ONE Arabic-script dictionary
(see `.issues/bundle-render-fonts.md`).

## The render pool's timeout was measuring the wrong thing

Until 2026-07-30 the pool posted every job to the worker at once and started each job's clock at
POST time, so eight concurrent callers all started their 20 s together and the last was "timed out"
by the seven ahead of it — a queue length reported as a wedged renderer. It now dispatches one job at
a time with the clock starting at hand-over, which is what makes a 10 s bound honest. If you ever see
a render-timeout number that seems too tight, check WHERE its clock starts before loosening it.
