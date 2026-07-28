# The share-image endpoint takes the whole site down in bursts

**Filed 2026-07-27 from the nightly log review. Severity: 🔴 P1 — whole-site outages, ~1–3 minutes
each, several times per evening, with real signed-in users failing to sync.**

## What happens

`GET /og?props=…` renders an Open Graph share card (1200×630 PNG) **synchronously, per request, in
the serving Node process**. A crawler fetches these in bursts roughly every five minutes. During each
burst the box stops answering: Caddy's active health check (`/healthz`, every 3 s, 2 s timeout)
fails against **both** `sveltekit_blue` **and** `sveltekit_green`, and Caddy then has nowhere to send
traffic.

Production evidence, 24 h ending 2026-07-27 21:00 UTC:

| Signal | Count |
|---|---:|
| Caddy `no upstreams available` (a request Caddy could not serve at all) | **1,553** |
| Caddy health-check failures — `sveltekit_blue` | 1,047 |
| Caddy health-check failures — `sveltekit_green` | 471 |
| Client `sync_failed` rows carrying **HTTP 502** | **152**, across **21 signed-in users** |
| Client `sync_failed` rows carrying HTTP 503 | 64, across 18 users |

The outages are bursty — only **35 minutes** of the day contained any `no upstreams available` —
and every non-deploy burst lands inside a minute that also produced `/og` failures:

| Outage minutes (UTC) | Cause |
|---|---|
| 05:15–05:16, 09:57–10:50, 14:18–14:19 | deploys (three today) — expected churn |
| **17:35, 18:44–18:45, 19:00–19:04, 19:50, 20:19–20:21** | **no deploy — each coincides with an `/og` render burst** |

## Why it is expensive

Measured inside the production container (read-only probe, 8 concurrent distinct cards):

- one **cold** card render = **~700–840 ms**, and the work serializes on the single Node thread;
- 8 concurrent renders took **~5.0–5.7 s each**, and during them `/healthz` latency climbed to
  **3,251 ms** — past Caddy's 2 s health timeout, which is precisely the production failure;
- the photo transcode itself is *not* the problem: `sharp` decodes a WebP → JPEG in **56–88 ms**, and
  8 concurrent transcodes finish in 290 ms (libuv thread pool). The cost is **satori + resvg**, both
  synchronous, now rasterizing a ~193 KB base64 data-URI photo per card.

## Why it started mattering today

Before the 2026-07-23 photo→R2 (WebP) migration, cards rendered normally. Between July 23 and this
morning, every photo card **failed fast** (`Unsupported image type: image/webp`) and fell back to a
cheap text-only render — accidentally rate-limiting the endpoint. This morning's fix
(<File path=".issues/og-share-image-webp-regression.md" />) correctly restored the photo, which also
restored the full render cost on a crawler-driven endpoint. **The fix is right; the endpoint's shape
is wrong.**

## Three unbounded things

1. **Unbounded process memory.** `component-to-png.ts` `withCache()` is a plain `Map` with no size
   cap, holding every rendered PNG (~220 KB each) for the life of the process. `loadDynamicAsset` is
   wrapped in the same unbounded cache, holding a font buffer per unique text run.
   Live proof: `sveltekit_blue` (serving) sits at **2.87 GiB RSS** after 7 hours, versus **1.17 GiB**
   for `sveltekit_green`, which booted at the same moment and ran the same crons but takes no
   traffic. The ~1.7 GiB delta implies on the order of **~1,000 card renders per hour**.
2. **Unbounded concurrency.** Nothing limits how many renders run at once; a burst maps 1:1 onto
   simultaneous CPU-bound renders.
3. **Unbounded outbound fetches.** `loadDynamicAsset` fetches Google Fonts with **no timeout**
   (`component-to-png.ts:128`), once per unique text run. Production shows repeated
   `Failed to load dynamic font … AggregateError [ETIMEDOUT]`, and during the same windows the
   `card_image` fetch of an R2 photo — which completes in 13–150 ms when the box is idle — fails with
   `TypeError: fetch failed` / `TimeoutError` (**84 `og_image_transcode_failed` rows today**). The
   R2 snapshot uploader also hit `ETIMEDOUT` at 14:19. Outbound networking degrades in exactly the
   same windows.

## Proposed fix (not yet applied — read-only review)

In rough priority order:

1. **Persist rendered cards outside the process.** Key on a hash of the decoded props +
   `OG_IMAGE_VERSION` + size; store under `DATA_DIR` (or R2, like the site-owned image keys) and
   serve on a hit with zero CPU. A crawler re-fetch then costs a file read. This alone removes the
   burst load, since crawlers re-request the same cards repeatedly, and it makes the in-process cache
   unnecessary.
2. **Bound concurrency.** Allow at most 1–2 renders in flight (the box has 2 cores). Past that,
   either queue with a short deadline or return the cheap globe/text card immediately — a scraper
   getting a slightly plainer card is strictly better than the site going down.
3. **Cap the in-process caches.** Give `withCache` an LRU bound (the `card_image` memo already has
   one at 25). Today's leak is a slow OOM path independent of the outages.
4. **Time-box the Google Fonts fetch** (e.g. `AbortSignal.timeout(3000)`) and cache the *negative*
   result, so a font CDN hiccup cannot hold a render slot for ~21 s.
5. **Emit success telemetry** — see the coverage item in the 2026-07-27 log review: `/og` currently
   logs only failures, so its request volume and duration are invisible and had to be inferred from
   container memory growth.

## Status

Items 1–5 shipped 2026-07-27/28 (see
<File path=".issues/canonical-bot-detection-and-og-endpoint-shape.md" />), and the residual they left
— the render still happening on the request thread at all — is closed by
<File path=".issues/og-render-off-main-thread.md" />: satori/resvg now run in a worker thread.

## Standing rule this violates

2026-07-27 (Jacob): *analytics and telemetry must never block a request path* — "it shouldn't be
blocking." The same principle applies to any expensive on-request computation: **the question is not
"is it fast enough" but "whose request pays for it."** For share cards the answer should be "nobody's
— it was rendered once and stored."

## Related

- <File path=".issues/og-share-image-webp-regression.md" /> — this morning's photo fix (correct; keep).
- <File path=".issues/analytics-compute-blocks-server.md" /> — the same class of problem on the
  admin analytics path, fixed today. Note the analytics warm-up now runs from the retention cron on
  **both** containers at the same moment (both swept at 20:17 today, inside the 20:19–20:21 outage);
  worth confirming it yields as designed once `admin_analytics_computed` rows exist.
