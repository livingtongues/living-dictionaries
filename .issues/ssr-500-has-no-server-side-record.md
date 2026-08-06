# Every 500 this site serves is undiagnosable — no server-side record exists

Found by the 2026-07-31 nightly log review. **Investigated and fixed 2026-08-01 (uncommitted).**

## RESOLUTION — the hook was never broken; the site had no server 5xx at all

The review's two candidate explanations were mutually exclusive and, it turns out, both wrong about
where to look. Production settles it:

```sql
-- rows written BY handleError (context carries route+path+status)
SELECT json_extract(context,'$.status') status, level, COUNT(*)
FROM client_logs WHERE source='server' AND context LIKE '%"path"%' GROUP BY status, level
```

| status | level | rows |
|---:|---|---:|
| 404 | info | 32,804 |
| 405 | warn | 61 |
| 500 | info | 6 |

**`handleError` has been running correctly the entire time** — 32,871 rows written by it. Hypothesis
(1) ("the write is lost") is disproven: the same function, on the same code path, wrote 32 thousand
rows. The six 500s are all `message = 'aborted'` on `/api/dictionary/[id]/changes` +
`/api/v1/.../entries` — genuine client disconnects, correctly demoted to `info` by the existing
`is_client_abort` branch.

The count of `crash` rows is zero because **no server-side 5xx render has ever happened**. All 403
`Internal Error` rows in the log history were raised by SvelteKit **in the browser**:

| check | result |
|---|---:|
| `Internal Error` crash rows, all time | 403 |
| …fired within 2 s of that session's `session_start` | **399** |
| …whose session contains any other `error`/`unhandled_rejection` row | 59 |

A crash 3 ms after `session_start`, with `breadcrumbs: []`, `nav_type: 'navigate'` and a healthy
`page_load` perf row alongside it, is a **hydration failure**: the HTML arrived 200, the app booted,
and SvelteKit's client runtime caught a fault in its own load/render path and rendered its 500 page
with `message: 'Internal Error'`. There was no `hooks.client.ts`, so the real exception was
discarded — and because a hydration fault can happen before `init_remote_logging()` patches
`console.error`, even the default handler's `console.error(error)` was not reliably captured.

So: hypothesis (2) was right, but the review could not confirm it because the *server* half looked
guilty. It wasn't.

## Repair — shipped 2026-08-01

- [x] **`error_id` on the server hook** (`hooks.server.ts`). An 8-char id is generated for `crash`
      level only, written into the logged `context` **and** returned to the browser as
      `App.Error.error_id` (declared in `app.d.ts`). Deliberately **not** appended to `message` —
      the log review clusters by message, and a unique id per row would shatter one cluster into
      hundreds. `+error.svelte` renders it as a quotable `ref:` for support.
- [x] **`hooks.client.ts`** — logs `client_error: <real message>` at `error` with
      `{ route, path, status, stale_build }` plus the stack. `log_event` buffers pre-init and
      replays on `init_remote_logging()`, so a hydration-time fault still ships.
      **No recovery action** — the reload-once rule already lives in the data layer
      (`$lib/db/client/stale-build-artifact.ts` → `dict-client/stale-bundle-recovery.ts`); a second
      mechanism here would race it and double-spend its one-reload guard. The classifier is used
      only to LABEL the row.
- [x] **`$lib/debug/last-client-error.ts`** — one-slot, consumed-on-read handoff so the `crash` row
      from `+error.svelte` carries the cause + stack instead of standing alone.
- [x] **`+error.svelte`** now logs `{ cause, error_id, origin: 'server' | 'client' }`. The
      ambiguity that cost this review a night is now impossible: **`origin` says which half broke.**
- [ ] ~~process-lifetime counter of dropped `insert_client_log` writes~~ — dropped. It was proposed
      to test hypothesis (1), which is now disproven with 32,871 rows of evidence; adding a counter
      to a path shown to work is instrumentation for its own sake.

## Verified end-to-end in dev (headless Chromium against `pnpm dev`)

A `+page.server.ts` that throws (SSR 500):

```
source=server level=crash  "deliberate ssr boom…"  {"route":"/_boom_ssr","status":500,"error_id":"347778e1"}
source=client level=crash  "Internal Error"        {"error_id":"347778e1","origin":"server","cause":null}
```

A universal `load` that throws in the browser (client 500):

```
source=client level=error  "client_error: deliberate client load boom…"  {"route":"/_boom_client","status":500,"stale_build":false}
source=client level=crash  "Internal Error"  {"error_id":null,"origin":"client","cause":"deliberate client load boom…"}
```

Both temporary routes were deleted after the run.

## Next review should

- Re-run the counts. `source='server' AND level='crash'` will probably STILL be 0 — that is now the
  correct, meaningful answer, not a blind spot.
- Cluster the new `client_error: …` rows. This is where the ~15/day of real "Internal Error" causes
  will finally show up, and it is the first time they have ever been visible. Expect a mix of
  stale-chunk imports (`stale_build: true`, already handled by the data-layer rule) and genuine
  hydration faults on entry/dictionary pages.

## Notes

- Do **not** treat the crawler share as a reason to deprioritise: 500s hit real visitors too, and a
  route that 500s for Googlebot is a route that fails to index.
- The reason this went unnoticed for so long is that the *client* side of the pipeline works
  perfectly — the dashboards and reviews have always had a count of 500s, just never a cause.
