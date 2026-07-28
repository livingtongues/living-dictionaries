# Two approved repairs from the 2026-07-27 nightly fleet reports

Executed on `main`, left UNCOMMITTED for Jacob's review.

**Verification:** `npx vitest run` (307 files, 2,247 tests) green · `pnpm check` **0 errors**
(46 pre-existing warnings, unchanged) · `eslint` clean on every touched file · production
`node build` booted and load-probed with `curl` (numbers below) · a rendered card and the generic
fallback card both eyeballed as images.

Sources: <File path=".cron/log-reviews/2026-07-27.md" /> · <File path=".issues/og-endpoint-load-outages.md" />

---

## ITEM 1 — the robot gate blanks the app for real people (P0, user-facing)

Commit `f8b13cde` gated the whole offline-database boot (`+layout.server.ts` → `is_bot` →
`[dictionaryId]/+layout.ts` → `session = null`) behind LD's own imprecise substring matcher
(`BOT_PATTERN` in `$lib/debug/parse-user-agent.ts`). Any UA containing the substring `bot` or
`whatsapp` was called a crawler:

- **CUBOT** — a real Android phone brand (`Android 12; CUBOT NOTE 20`) → substring `bot`.
- **WhatsApp's in-app browser** (`… Mobile Safari/537.36 WhatsApp/2.24.6.78`) — the single most
  common way a community member opens a shared dictionary link → substring `whatsapp`.
- Sogou's consumer mobile browser (`SogouMobileBrowser`) was fine under the old list, but the
  `spider` marker family has the same shape of bug.

Consequence for those people: null dict session → no leader election → no worker → no offline
database → **empty entries list and every edit blocked.**

### Approved fix (overrides two prior standing decisions — now law)

ONE canonical copy of the robot-classification logic, adopted **verbatim** across the fleet, plus a
test that FAILS when the copies drift. The endorsed content is house's **precision**:

1. word boundary on the three generic markers `bot` / `crawler` / `spider` — `/(?:bot|crawler|spider)(?![a-z])/i`
2. strip consumer device brands (`cubot`) BEFORE the generic tail runs
3. the `whatsapp` marker only counts when the UA is NOT a full browser (no `mozilla` token)

### CRITICAL TRAP (must survive the port)

house exports TWO functions with identical signatures and deliberately opposite missing-UA policy:

| export | missing UA | used for |
|---|---|---|
| `is_bot_user_agent` | **NOT** a bot | classifying stored rows; **LD's boot gate** |
| `is_bot_or_unknown_user_agent` | IS a bot | house's fail-closed warm-up gate |

LD's boot gate MUST keep the FIRST. Failing closed here = a blank application for anyone whose UA
header is stripped. LD's existing assertion (`is_bot_request({ user_agent: null }) === false`) must
survive.

### Work

- [x] `site/src/lib/utils/bot-user-agent.ts` — byte-identical copy of
      `~/code/house/site/src/lib/utils/bot-user-agent.ts` (canonical path, canonical names).
- [x] `$lib/debug/parse-user-agent.ts` — drop `BOT_PATTERN` + `is_bot_user_agent` + their tests;
      the file keeps only UA *parsing* + capability. All importers moved to `$lib/utils/bot-user-agent`.
- [x] `$lib/server/is-bot-request.ts` — imports the canonical `is_bot_user_agent` (NOT the
      `_or_unknown` variant), with regression tests for CUBOT / WhatsApp in-app / Sogou mobile /
      null UA.
- [x] `site/src/lib/utils/bot-user-agent.parity.test.ts` — cross-repo drift guard, same shape as
      house's `$lib/db/worker/parity.test.ts`: reads the sibling repos from `~/code`, skips
      gracefully when they aren't checked out (CI), and fails loudly on any logic drift.
- [x] **All three repos now hold the identical file** (sha256 `b8a712ce…`). tutor's copy landed the
      same night, after this session's first run reported its arm as skipped — the tutor arm of the
      parity test now actually runs and passes (9/9 at commit time).

---

## ITEM 2 — the share-image endpoint takes the site down (P1)

Full evidence in <File path=".issues/og-endpoint-load-outages.md" />. Measurements taken inside the
production container: one cold card ≈ **700–840 ms**; **8 concurrent** stretch to **5.0–5.7 s each**
and push `/healthz` to **3,251 ms** against Caddy's **2 s** timeout → both containers marked down →
1,553 refused requests, 152 `sync_failed` 502s across 21 signed-in users. Serving container 2.87 GiB
RSS vs 1.17 GiB idle standby ⇒ ~1,000 renders/hour retained forever.

**This morning's photo fix is CORRECT and stays.** The endpoint's shape is what's wrong.

Approved, in order:

- [x] **1. Render once, persist.** `card-store.ts` — disk store under `<DATA_DIR>/og-cache/`, keyed
      by a hash of the encoded `props` param + the `?v=` `OG_IMAGE_VERSION` + a store format version.
      A repeat fetch costs one file read and zero CPU. Atomic temp+rename (blue and green share
      `/data`, so a card rendered by one is free for the other). Bounded at 1,000 entries / 250 MB,
      pruned oldest-first off the request path, mtime touched on a hit for approximate LRU.
      Regenerable, so nothing here needs backing up.
- [x] **2. Bound concurrency.** `render-queue.ts` — one render in flight, a 4 s wait deadline, a
      12-deep queue, **and a time budget: renders may occupy at most half of any 10 s window.**
      The budget was NOT in the plan; measurement forced it (see below). Past any of those limits
      the request is shed with zero CPU.
- [x] **3. Cap the in-memory caches.** `withCache`'s unbounded `Map` is gone: the PNG memo is
      replaced by the disk store (nothing renders twice, so an in-process copy buys nothing), and
      the font loader gets a 100-entry bounded LRU that also caches negatives.
- [x] **4. Time-box the font fetch.** `AbortSignal.timeout(3000)` on BOTH Google Fonts requests
      (the CSS lookup and the TTF), negative result cached, so a CDN hiccup can't hold a render slot
      for the ~21 s OS connect timeout.

### What the measurements changed (production build, 2-core box — same core count as the VPS)

Two things in the plan turned out to be wrong, and are the most important part of this work:

1. **A pure concurrency limit is nearly a no-op.** A burst of N distinct cards does not arrive as N
   concurrent handlers: the thread is blocked inside render #1 while the other connections sit in
   the accept queue, so handler #2 only runs after #1 finishes. Every render logged `wait_ms: 0`.
   What hurts is the BACKLOG — 20 new cards = 38 s of back-to-back rendering, and a `/healthz` that
   lands behind it waited **28 s**. Hence the time budget: it caps the share of the process `/og`
   may consume, which is the thing `/healthz` actually competes for.
2. **Handing the slot to the next waiter through a promise resolution made things WORSE.** Two
   synchronous renders then chain inside one event-loop iteration, so the loop never reaches its
   poll phase: measured `/healthz` at **18.3 s** across a burst of 8. The handoff now goes through
   `setImmediate` (the same reasoning as `$lib/server/breathe.ts`), which bounds the wait at one
   render. There is a unit test pinning this.

Measured, four crawler passes over the same 20 cards on a fresh store (renders on this box are
~1.9 s idle / ~3.5–4 s under the burst, vs 0.7–0.84 s in the production container):

| Pass | Real cards | Degraded | Stored on disk | `/healthz` median | `/healthz` max | over 2 s |
|---|---:|---:|---:|---:|---:|---:|
| 1 (all new) | 3 | 17 | 3 | 1.4 ms | 5.97 s | 1/60 |
| 2 | 6 | 14 | 6 | 2.9 ms | 6.98 s | 1/60 |
| 3 | 8 | 12 | 8 | 3.0 ms | 7.59 s | 1/60 |
| 4 | 11 | 9 | 11 | 1.7 ms | 7.07 s | 1/60 |

- Same burst on the pre-fix shape: **20 renders, 36–38 s, `/healthz` up to 25–28 s.**
- A stored card is served in **13–26 ms** with no CPU; 8 warm cards complete in **74 ms** total.
- During ONE render with a quiet client, `/healthz` is **1.3 ms median, 1.74 s worst** — i.e. the
  worst case is now "wait for the render in front of you", not "wait for the backlog".

**Honest residual:** worst case is ~1–2 render durations (poll-phase FIFO can put one more card
request ahead of a health check). In production that is ~0.8–1.7 s against Caddy's 2 s timeout —
under it, but not by a lot. The real cure is to move satori/resvg off the main thread (worker
thread / child process) so a health check can never wait on a render at all. NOT done here — it is
a bigger change than the four approved repairs. Filed as the follow-up below.

### Extra (small, within the shed path)

A shed request used to mean a 1×1 transparent PNG, which is a bad thing to leave in a scraper's
cache. The process now renders the generic Living Dictionaries card ONCE, while idle and off the
request path, stores it, and serves it for every shed/failed request (with the 60 s TTL, so the
scraper comes back for the real card). Never more than one such render per container; 58 KB on the
wire, and visually verified.

### Two things worth knowing for review

- `new Response(buffer)` does NOT typecheck under this TS lib: `BodyInit` wants a view over a plain
  `ArrayBuffer`, and neither a node `Buffer` nor `Uint8Array<ArrayBufferLike>` is one. The old code
  only passed `svelte-check` because `withCache` returned `any`. Hence the one-line `png_response()`
  re-wrap (a ~220 KB memcpy, immaterial next to a render).
- The store lives at `<DATA_DIR>/og-cache/`, i.e. `/opt/hosting/data/og-cache` on the VPS, shared by
  the blue and green containers. It is fully regenerable and must never be added to a backup set.

### Deliberately NOT done

- **The issue's item 5 (per-request `/og` success telemetry)** was outside the four approved
  repairs. What is included is a **miss-only** `og_card_rendered` line (render_ms + queue wait) plus
  `og_render_shed`. Once the store is warm those are rare, and they are what makes this verifiable
  in production. No per-request logging on the hit path.
- **Moving the render off the main thread** (see residual above).
- **Nothing about this morning's photo fix was touched** — `card-image.ts` is unchanged.

### Follow-up worth filing after review

`/og` renders on the request thread at all. A worker thread (or a tiny render sidecar) would make
`/healthz` completely immune, and would let the budget be relaxed so more cards render per pass.
