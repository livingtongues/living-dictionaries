# Stale-client sync storm — 2026-07-08 (SW not self-updating)

From the 2026-07-08 log reviews (`.cron/log-reviews/2026-07-08.md`, runs 1 + 2). The entry-page
bug storm was fixed same-day, but the residual error volume was entirely a **stale-client
population**: tabs stuck on the 5-day-old **07-03 build** (`…096241136` and siblings) that
predates the `f66b209c` client_behind retry brake, retry-storming `/changes` forever.

## Who was stuck (as of run 2, 21:07 UTC)

| Who | Role | sync_failed rows (24h) | Level | Cause |
|---|---|---:|---|---|
| `marlene.vizuet@gmail.com` | Zapotec editor (non-admin) | 4,034 (1,342 error) | error | `schema_outdated` on `zapoteco-de-la-sierra-n` + fatal `dictionary not found` 404 on `zapoteco-de-analco` |
| `livingtongues@gmail.com` (admin Greg) | L2 admin | 1,630 | warn | `schema_outdated`, one 24h-lived tab, STILL stuck 9h after run 1 flagged it |
| 2 anonymous tabs | — | ~1,070 | warn | client_behind, draining |

Jacob will personally nudge Greg + marlene to hard-reload — no user contact needed from agents.

## Open questions / follow-ups

- [ ] **Why won't the service worker update these tabs?** Their sessions show
  `ServiceWorker … unknown error` / `Timed out` clusters. A tab left open for days should
  still pick up a new SW on navigation or at the 24h update check — these don't. Investigate
  the SW registration/update path (update check cadence, `skipWaiting`/claim behavior, whether
  a never-navigating long-lived tab ever activates a waiting SW).
- [ ] **Should `decide_client_behind_recovery` force a hard reload after N persistent
  `schema_outdated` blocks?** (`site/src/lib/db/client/client-behind-recovery.ts`, used from
  `[dictionaryId]/+layout.ts`.) Today it latches/blocks but a backgrounded tab can sit blocked
  forever. A forced `location.reload()` after N blocks (or on the next visibilitychange→visible)
  would self-heal the whole class. Weigh against losing unsaved UI state.

## Folded-in code audits (from the 07-08 log-review working notes)

- [x] **`sync-failure-classify.ts` 404-fatal check** — audited 2026-07-09. A `/changes` 404 now
  classifies as a distinct `not_found` kind: `error` level, non-transient, so
  `RepeatFailureTracker` halts the engine after 3 identical attempts (no more infinite 404
  retry storms on current builds), and the Sync-Health panel names the cause instead of `other`.
  Marlene's 1,342 error-level rows were exactly this class on a pre-breaker build.
- [ ] **SW stale-tab hard-reload** — same as the `decide_client_behind_recovery` question above.

## Context: why the levels looked inconsistent

Run 2 flagged "`sync_failed` logs at both warn and error". Current code already levels BY CAUSE
(`sync_failure_level`): retryable kinds (client_behind/schema_outdated, network, auth, …) → warn;
fatal kinds (corruption, not_found, other) → error. Marlene's error rows were the fatal 404 class
(correctly error); Greg's warn rows were schema_outdated (correctly warn). No blanket downgrade —
the fatal-error rows are the class that caught house's live Wayne incident.

## 2026-07-15 — another instance: `river` (secure-flip trigger, same 404 class)

Spotted during the structured-grammar cutover smoke test: a stale client polls dict `river` →
404 `sync_failed` every ~30s (26× in a 44-min window; `{"engine":"dict","dict_id":"river","status":404}`,
`user_id` NULL). NOT a deleted dict — `river` is `bucket='secure'`, so the secure-gate
(`$lib/db/server/secure-dictionary.ts` / `verify_auth_dict_role`) returns the unknown-slug 404 to a
non-authorized (or logged-out/cached) client. Root cause is identical to marlene's `zapoteco-de-analco`
rows: a **pre-404-breaker build** that never halts on `not_found`. Current builds halt after 3 identical
404s (`sync-failure-classify.ts`), so this is another stale-tab symptom — the SW-stale-tab-hard-reload
follow-up above would clear it. No new fix needed; folding it in as evidence the class is still live.

## Dashboard support (shipped 2026-07-09)

- Build-adoption strip on `/admin/health` — sessions grouped by build age with the
  "N% of active sessions can't receive fixes" headline + named stale users.
- Storage/WAL strip on `/admin/health` (logs.db was 467MB, +~110MB/day during the storm).
