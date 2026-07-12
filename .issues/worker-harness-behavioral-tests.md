# Behavioral tests for the leader-worker harness (transport / election / boot wiring)

**Recommendation strength: WORTH EXPLORING (pure win, no refactor risk). Not yet assigned.**

## Problem

The most failure-prone async machinery in the app — the per-dict leader-worker harness in
`site/src/lib/db/dict-client/worker/` — has **no behavioral unit tests** in either repo:

- `transport.ts` (240 lines): RPC buffering until first `ready`, re-send of outstanding requests
  on every new `ready` epoch (leader hand-off mid-flight), 20s timeout, `client_id` filtering,
  ping/pong leader discovery.
- `leader-election.ts`: Web Locks–based election, `resign()` / `reacquire()` semantics,
  no-navigator fallback.
- `leader-worker.ts` + `db-client.ts` wiring of the boot watchdog and retry/resign/re-enter loop.

What IS tested: the **pure decision pieces** (`boot-recovery.ts`'s `with_boot_timeout` +
`boot_retry_decision`, `db-capabilities.ts`) via inline `import.meta.vitest` blocks — the classic
"pure functions extracted for testability" pattern. But the past incidents (RPC wedge when a
factory hangs, the lone-tab dead-end, stale-leader `schema_outdated` loops — all described in
code comments and `.knowledge/`) were all **wiring** bugs: how those pieces are called, in what
order, holding which lock. That layer has only e2e `.mjs` flows (`site/e2e/dict-sync.mjs`,
`dict-watch-2ctx.mjs`, `dict-delete-2tab.mjs`) and prod telemetry.

House parity note: these files are copy-paste shared per house's
`$lib/db/worker/PARITY.md`, byte-enforced by house's `parity.test.ts`. **Behavioral tests double
as executable documentation for BOTH repos** — every invariant encoded is leverage ×2. Decide
with Jacob where the tests live w.r.t. the parity manifest (probably: tests live in ONE repo
(house, the canonical copy) OR in both as a parity-listed test file — check the manifest's
existing conventions for `identical` vs `adapted` files before creating files that would break
byte-parity).

## Invariants to encode (each currently lives only in a comment)

### transport.ts — testable with real `BroadcastChannel` (available in vitest/happy-dom and node ≥18)

Create a client and a fake "leader" on the same channel name (the test plays the worker side by
listening for `req` messages and posting `res` / `ready` / `event`):

1. **Buffer-until-ready:** `request()` before any `ready` does not hit the wire; after the fake
   leader posts `ready`, the buffered request is sent and resolves.
2. **Re-send on new epoch:** request sent, no response; a NEW `ready` (different `epoch`)
   arrives → the outstanding request is re-sent; the response to the re-send resolves the
   original promise (and the eventual duplicate response, if any, is ignored — assert no
   double-settle).
3. **Timeout:** no leader ever responds → rejects with the timeout code after the configured
   window (use fake timers; export/parameterize `DEFAULT_TIMEOUT_MS` via options if needed —
   `request` already takes `{ timeout_ms }`).
4. **client_id filtering:** responses addressed to a different `client_id` are ignored.
5. **Ping/ready discovery:** a client created AFTER the leader is up (missed the original
   `ready`) discovers it via ping → `ready()` resolves. (`PING_RETRY_MS` cadence — fake timers.)
6. **Events:** `on_event` receives leader `event` messages; unsubscribe stops delivery;
   `destroy()` closes the channel (no delivery after).
7. **Error responses:** `ok: false` with `{ code, message }` rejects the request with a
   matching error shape (this is what `sync-failure-classify` consumes downstream).

### leader-election.ts — testable with a stubbed `navigator.locks`

`navigator.locks` isn't in happy-dom; stub a minimal LockManager (grant queue you control):

1. First requester gets `on_promote`; second doesn't until the first releases.
2. `resign()` releases the lock → queued waiter promotes.
3. `reacquire()` after resign re-enters; no-op while leading or while a request is in flight.
4. No `navigator.locks` at all → documented fallback behavior (read the code tail for what it
   does — assert it, whatever it is: immediate promote or never-promote).

### boot wiring (leader-worker.ts / db-client.ts) — the seams around the tested pure pieces

These are harder (they import the OPFS connection factory). If they take an injectable factory,
test with a hanging factory (never-resolving promise) and fake timers:

1. Hanging factory → `boot_failed` posted after `BOOT_TIMEOUT_MS`/idle window; watchdog resets
   on progress ticks (a factory that ticks progress every few seconds never trips it).
2. Spawning tab retries its own boot `MAX_BOOT_RETRIES` times with backoff, THEN resigns, THEN
   re-enters election on the long backoff (lone-tab self-heal — the exact past incident).

If the factories aren't injectable, make the smallest possible parameterization (default arg =
real factory) — that's an `adapted`-safe change but touches parity files; coordinate with house
(same change lands there via the parity sweep).

## Non-goals

- No behavior changes. Any refactor beyond optional dependency-injection defaults is out of
  scope.
- Don't try to test real OPFS / real Web Locks / a real Worker — that's what the e2e `.mjs`
  flows cover. These tests are for protocol/sequencing logic.

## Verification

- `pnpm test` green; new tests fail meaningfully when you sabotage the code (spot-check by
  reverting one guard, e.g. the re-send-on-ready loop, and watching the test catch it).
- Byte-parity: if test files are parity-listed, run house's `parity.test.ts` (or the LD
  equivalent) after; if tests live house-side only, sync per the PARITY.md manifest process.
