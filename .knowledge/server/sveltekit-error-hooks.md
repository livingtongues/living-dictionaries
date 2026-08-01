# The two error hooks — which half of the app broke, and how to prove it

Established 2026-08-01 while resolving "zero server `crash` rows have ever been written". The code
now says WHAT it does; this page is the part you cannot read off it — the measurement, the reasoning,
and the query that settles the question next time.

## The trap

SvelteKit produces the **same** error page, with the **same** sanitized message (`Internal Error`)
and the **same** status (500), whether the fault happened during SSR or in the browser. `+error.svelte`
logs `page.error.message`, so `client_logs` fills with `crash` rows that look identical and name
nothing. For most of this app's life that made every 500 both invisible *and* mis-attributed: the
07-31 review reasonably concluded the SERVER hook was broken, because ~130 error pages a week were
being reported by browsers while `source='server' AND level='crash'` returned 0 out of 1.3 M rows.

**It was never the server.** `handleError` had written 32,871 rows (32,804 × 404 at `info`, 61 × 405
at `warn`, 6 × 500 that were genuine client aborts). The zero is the correct answer: **no server-side
5xx render has ever happened on this site.** All 403 `Internal Error` rows were raised by SvelteKit
in the browser, 399 of them within 2 s of `session_start` — i.e. during hydration, on a page whose
HTML arrived 200 with a healthy `page_load` perf row beside it.

## The query that settles it

Rows written by the server hook are identifiable by their context shape (`route` + `path` + `status`):

```sql
SELECT json_extract(context,'$.status') AS status, level, COUNT(*)
FROM client_logs WHERE source='server' AND context LIKE '%"path"%'
GROUP BY status, level;
```

If that returns thousands of 404s, the hook is alive and the silence at 5xx is real information, not
a missing write. Then check where the error pages actually come from:

```sql
SELECT COUNT(*) FROM client_logs c
WHERE c.message='Internal Error' AND c.level='crash'
  AND EXISTS (SELECT 1 FROM client_logs s WHERE s.session_id=c.session_id
              AND s.message='session_start'
              AND julianday(c.received_at)-julianday(s.received_at) BETWEEN 0 AND 2.0/86400);
```

A crash within ~2 s of `session_start`, with `breadcrumbs: []`, is hydration. Since 2026-08-01 you
don't need either query for new rows: **`context.origin`** on the crash row says `server` or
`client` outright, and a server-origin row carries the `error_id` that joins it to the server row
holding the stack.

## Design constraints worth remembering

- **Never put a unique id in the `message`.** The log review clusters by `message`; a per-row
  reference would shatter one cluster into hundreds. `error_id` lives in `context` (and in
  `App.Error`), never in the text.
- **`log_event()` before `init_remote_logging()` is safe.** `remote-log`'s `push()` buffers into an
  in-memory pre-init buffer and replays on init — which is the only reason a hydration-time fault
  can be reported at all. It does mean a fault so total that `+error.svelte` never mounts is still
  lost; that residue is accepted.
- **The client hook must not do recovery.** The reload-once rule for deleted build artifacts lives
  in the data layer (`$lib/db/client/stale-build-artifact.ts` → `dict-client/stale-bundle-recovery.ts`),
  where it can see the leader-worker boot ladder and owns a one-reload guard. A second mechanism in
  `hooks.client.ts` (which is where **house** puts its equivalent) would race it and double-spend
  that guard. LD's hook only *labels* the row `stale_build: true`. A parity sweep has already once
  reported the rule "absent" from this repo because it looked in `hooks.client.ts` — it is not, and
  should not be, there.
- **Worker rows bypass `remote-log` entirely** (`report-dict-sync-failure.ts` POSTs to `/api/log`
  directly, because the localStorage buffer doesn't exist in a worker). So a session with worker rows
  and no main-thread rows is a page that has stopped rendering — see
  `.issues/stuck-old-bundle-escape-hatch.md`.
