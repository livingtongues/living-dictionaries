# Every 500 this site serves is undiagnosable — no server-side record exists

Found by the 2026-07-31 nightly log review.

## The fact

`logs.db` holds **1,302,723 rows** covering 2026-07-17 → now. Of those:

- rows with `source='server' AND level='crash'`: **0** — not one, ever;
- rows with `source='server' AND level='error'`: **1** (`system_chat_delivery_failed`, 2026-07-30).

Meanwhile browsers report the 500 error page every single day, because `routes/+error.svelte` logs
what it is rendering:

| Day | `Internal Error` rows |
|---|---:|
| 2026-07-25 | 28 |
| 2026-07-26 | 19 |
| 2026-07-27 | 13 |
| 2026-07-28 | 13 |
| 2026-07-29 | 35 |
| 2026-07-30 | 10 |
| 2026-07-31 | 5 |

So we know exactly **when** and on **what URL** the site returns a 500, and nothing whatsoever about
**why**: no message, no stack, no route id, no request context.

Today's five, for reference — four Googlebot, one real iPhone visitor at 14:29 UTC:

```
/muysccubun
/nambya/entry/ImfAkGbtDSsvxdEfFSro
/panim/entry/O8XwpscTZ0kqrlTumPRv
/misar-tatar/entry/EwB0l3lsM1ylWsRRhkRE
/atakapa-ishakkoy/entry/8f3ff6fe-9f72-4824-9038-679d8e5944ea
```

All five answer **HTTP 200** on a fetch now, so this is intermittent, not a broken route.

## Why the silence — two candidates, and the logs cannot separate them

`hooks.server.ts:134` looks correct:

```ts
const level = is_client_abort ? 'info' : status >= 500 ? 'crash' : status === 404 ? 'info' : 'warn'
log_server_event({ level, message: …, error, context: { route: event.route.id, path: …, status } })
```

and nothing downstream rejects it — `VALID_LEVELS` in `insert-client-log.ts` includes `'crash'`, and
client-sourced `crash` rows are written every day through the same function.

1. **`handleError` runs but the write is lost.** `insert_client_log` catches everything and returns
   `false`; `log_server_event` catches again on top. A failure at either layer leaves no trace
   anywhere — no row, no console line the review can reach.
2. **`handleError` never runs**, because the failure is a *client-side* navigation error rather than
   a server render. **There is no `hooks.client.ts` in this repo at all**, so SvelteKit falls back to
   its default "Internal Error" page with nobody logging the cause. The message the browser logs
   would be identical in both cases, which is precisely why the ambiguity exists.

Weak evidence for (1): all six of today's rows carry `breadcrumbs: []`, i.e. the error page was the
first thing in the session, which suggests a server render rather than an in-app navigation. Not
conclusive.

## Repair

- [ ] **Give `handleError` a short random `error_id`** (8 chars). Put it in the logged `context`
      **and** in the message returned to the browser. `+error.svelte` already logs
      `page.error?.message`, so it travels to `client_logs` for free.
      → A client row carrying an `error_id` proves the server saw it and gives the join key to the
      stack. A client row *without* one proves the failure was client-side. Either way the ambiguity
      above is permanently resolved, and it costs one line.
- [ ] **Add `hooks.client.ts` with a `handleError`** that logs
      `{ level: 'error', message: 'client_navigation_error', context: { route, status, message, stack } }`.
      Currently every unexpected error during client-side navigation is invisible.
- [ ] **Make the swallowed write path observable.** `insert_client_log` already
      `console.error`s on failure, but nothing in this repo reads container logs. Consider a
      process-lifetime counter of dropped inserts, surfaced with the next `server_started` event
      (see the separate coverage gap) — a logger that silently fails is worse than no logger.
- [ ] **Then** re-run the review's check: `SELECT COUNT(*) FROM client_logs WHERE source='server' AND
      level='crash'` should stop being zero, and the next 500 becomes a real bug with a stack rather
      than a URL and a shrug.

## Notes

- Do **not** treat the crawler share as a reason to deprioritise: 500s hit real visitors too (one
  today), and a route that 500s for Googlebot is a route that fails to index.
- The reason this went unnoticed for so long is that the *client* side of the pipeline works
  perfectly — the dashboards and reviews have always had a count of 500s, just never a cause.
