# Two signed-in people are stuck below the floor of every client-side self-heal

Investigation requested 2026-08-01 from the 07-31 log review §1.1 + the overnight brief. **Report
only — nothing implemented.** The recommendation needs a decision from Jacob (see "What to do").

## The two people, verified against production tonight

| | Evelyn Halstead | Rebekah Ingram |
|---|---|---|
| user | `5f663340…` · evelyn.m.halstead@gmail.com | `52327a30…` · algonquin manager |
| session | `49ad2afc…` (unchanged since ≥ 2026-07-17) | `d22601c2…` (unchanged since 2026-07-29 22:29) |
| bundle | `1783245164404` — built **2026-07-05 09:52 UTC** | `1785330268796` — built **2026-07-29 13:04 UTC** |
| dictionary | `solari` | `algonquin` (private) |
| failure | HTTP 409 `schema_outdated` on every `/changes` push | leader worker can't import `/_app/immutable/workers/chunks/DASUsDk6.js` |
| volume | **1,266** `sync_failed` rows, ~1 every 30 s, last 07-31 20:55 | 53 `leader_boot_failed` + 28 `dict_boot_recovery_exhausted`, last 07-31 22:31 |
| the cure that exists | auto-reload on `schema_outdated` — shipped **2026-07-12** (`a5c30731`), a week AFTER her bundle | the reload-once rule — shipped **2026-07-31 07:01**, two days after her bundle |

Both are running bundles built *before* the code written to rescue them. Neither has reloaded once
(same `session_id` throughout), which is the only action that would deliver the fix.

## Is any WORK actually wedged? No — checked, for both (2026-08-01)

This is the question that decides whether either of them needs to hear from us at all, and it is
answerable from telemetry because the **stuck-dirty watchdog** (`report_dict_stuck_dirty` →
`dirty_rows_stuck`, `dict-sync-engine.ts`) landed **2026-07-03** — two days BEFORE Evelyn's bundle
was built, so both stuck tabs contain it. It counts `dirty = 1` rows + local tombstones on a timer,
ships from the worker (so it survives a dead main thread), and warns whenever pending work is seen
at two consecutive checks.

| | Evelyn | Rebekah |
|---|---|---|
| `dirty_rows_stuck` rows, ever | **0** | **0** |
| `entry_created` / `entry_deleted`, ever | **0** / 0 | 17 / 1 — all by 2026-07-23, on sessions that synced cleanly |
| account created | 2026-07-05 12:34 — the same day as her bundle | 2026-01-05 |
| what is actually happening | a pull-only tab re-POSTing `/changes` every 30 s into a 409 | her dictionary will not open **at all** |
| harm | none to her; ~2,880 pointless requests/day to us | locked out of her own private dictionary since 07-29, still trying (last attempt 07-31 22:31) |

So the 1,266 `sync_failed` rows are **not** a person's work failing to save — Evelyn has never
written anything. Her tab is a stale viewer that has been re-asking a question the server keeps
refusing. Rebekah's earlier writes all reached the server while sync was healthy; her problem is
access, not data loss.

**Consequence for the nudge:** only Rebekah is worth an email, and its content is "your dictionary
won't open, here's the ten-second fix", not "your work is stuck".

## The decisive new fact: Evelyn's tab has no reachable UI at all

Her session has written **only** `sync_failed` rows for fourteen days — no `session_start`, no
`heartbeat`, no `navigation`, no `perf`, not one `visibility_visible`/`visibility_hidden`
transition. Those rows come from the leader **worker**, which ships straight to `POST /api/log`
(`report-dict-sync-failure.ts`) precisely because `remote-log`'s localStorage buffer doesn't exist
inside a worker.

So her *worker* is alive and talking to our server every 30 seconds while her *page* has emitted
nothing since before the log retention window. Whether the main thread is frozen, has been hidden
continuously for two weeks, or has a broken localStorage buffer, the conclusion is identical:

> **No toast, banner, modal or prompt we can write will ever be seen by that tab.** The only live
> channel is a worker whose code was frozen on 2026-07-05.

Rebekah's tab is the opposite shape — a normal live page that boots, fails, and gets revisited. UI
*can* reach her.

## What levers actually exist (each checked, not assumed)

**1. The in-bundle "new version available → Reload" toast — EXISTS IN BOTH STUCK BUNDLES.**
`kit.version.pollInterval: 60_000` + the root layout's persistent toast landed **2026-06-23**
(`d0a6d8c5`), before both bundles. I verified the mechanism is live in production:
`GET /_app/version.json` → `200 {"version":"1785554446227"}`, and the value tracks each deploy. The
SvelteKit poller (`runtime/client/utils.js`) is not visibility-gated, and the toast is created with
`dismiss_label`, which means `timeout_seconds` is `undefined` — it does **not** auto-dismiss.

So the escape hatch is already in their hands and is not being taken. For Rebekah that means the
prompt is missable (shown once per page life; a single "Later" silences it forever) or simply
ignored while the *dictionary* — the thing she actually wants — shows a spinner and says nothing.
For Evelyn it means nothing at all, because nothing renders.

**2. A server-side lever an OLD client already obeys — there is none.** Her 07-05 worker turns the
409 into `classify_sync_failure → 'client_behind'`, latches `#version_blocked`, ships one throttled
log row and stops. No response body, status or header we could send makes that code path do
anything else; `on_version_blocked` → broadcast → auto-reload is *newer code*. Same for the 404 on a
deleted chunk. This is the general shape of the problem: **the old bundle decides what a response
means, so "server-side lever" is only ever a lever the old bundle already contains.**

**3. A service worker forced reload — technically the only one that works, and already declined.**
A NEW service worker activates independently of the page bundle (Chrome update-checks the SW script
at most every 24 h whenever a functional event fires, and her tab fires fetches every 30 s), so
`clients.matchAll()` + `client.navigate(client.url)` in the new SW's `activate` would reload even a
zombie tab with a dead main thread. This is the **declined zombie-tab forced reload** (standing
ruling 2026-07-09, reaffirmed 2026-07-31 when the reload-once rule was deliberately scoped narrower:
foreground tabs only). Written down here so it stops being rediscovered as "the obvious fix" —
it is the obvious fix, and it is a deliberate no.

**4. An out-of-band human nudge (email).** Reaches both, today, and is the ONLY thing that reaches
Evelyn. `Ctrl/Cmd-Shift-R` fixes both instantly. A reload is safe for her unsynced work: the local
dict DB is not discarded, the fresh bundle applies the pending migrations and pushes her dirty rows
(this is exactly what `recover_from_schema_outdated` does automatically on the current build).

**5. Enumerate the residual population automatically.** Tonight it is exactly two sessions, and the
only reason we know that is a nightly agent reading a 2 GB log file by hand. Two shapes:
  - **at ingest** (`/api/log`): when a row arrives with `kind: 'client_behind'` or a terminal boot
    failure AND its `app_version` is older than N days, upsert `{ user_id, session_id, app_version,
    first_seen, last_seen, count }` into a small server-only table. **No scan at all** — one row at a
    time, on a write path that already runs.
  - **at query time**: fold it into the daily analytics child process (`analytics-snapshot.ts`), the
    only place we allow heavy `logs.db` scans since the 07-29 503.
  Either way it needs a surfacing decision (Notifications room? a panel on `/admin/health`?), which
  is why it isn't built tonight.

## What to do — recommendation

1. ✅ **DONE 2026-08-01 — emailed Rebekah** (rebekah.ingram@atfn.ca), wording dictated by Jacob, sent
   via SES `Living Dictionaries <support@livingdictionaries.app>` with `Reply-To: jacob@livingtongues.org`
   (MessageId `010f019fbcf9ad3d-8330aba0-…`). **Evelyn was deliberately NOT emailed** — no work is
   wedged (see the table above), she has never written a word, and the only cost of her tab is our
   own request noise. Text sent:

   > **Subject: Quick fix for the Algonquin dictionary not loading**
   >
   > Hi Rebekah,
   >
   > We noticed the Algonquin dictionary hasn't been loading for you recently. Your browser tab is
   > running an older version of the site, so we're getting requests for a file that's out of date.
   > Please close all your Living Dictionaries tabs, then open the site again and it should open
   > normally. Make sure that all of your tabs are closed on your entire computer before you reopen.
   >
   > Thank you,
   > Jacob

   **Follow-up check:** her session `d22601c2…` should stop appearing, replaced by a new session on a
   current `app_version` that boots `algonquin` cleanly. If it doesn't, the diagnosis is wrong and the
   OPFS file itself is the problem, not the bundle.

   *Sending note for next time:* `@aws-sdk/client-ses` is **bundled** into `build/server` by
   adapter-node (it's a devDependency), so it is NOT importable from inside the running container —
   `docker exec sveltekit_blue node` can't `require` it. The send was run from mustang against the
   container's own SES env vars, piped over ssh and never written to disk.
2. **Then, the general cure (client-side, helps everyone future):** escalate the update prompt when
   the app is *demonstrably broken* rather than merely out of date — a version-blocked sync or a
   terminal dict boot should re-arm the reload prompt and state the problem in the dictionary
   surface itself, instead of a dismissible toast fired once per page life. This is the third
   sighting of the standing action item "show a person something when their dictionary fails to
   open" (07-27, 07-29, 07-31 §1.3), and it would have caught Rebekah. It does **not** reach a tab
   whose main thread is silent — accept that residue.
3. **Only if the residue stays non-zero after (2):** build the ingest-time detector (5a) so the list
   is a query, not a nightly read-through.

## Explicitly NOT proposed

- A second stale-build recovery mechanism. This repo already has one, in the data layer
  (`$lib/db/client/stale-build-artifact.ts` → `dict-client/stale-bundle-recovery.ts`, wired into
  `dict-session.ts`). A parity lane wrongly reported it absent because it looked in
  `hooks.client.ts`. The new `hooks.client.ts` deliberately only *labels* stale-build faults.
- Forced reload of background/zombie tabs (see lever 3 — declined, twice).

## The rule this establishes (worth keeping)

> A client-side self-heal can only ever reach the population that has already reloaded since it
> shipped — which structurally excludes the long-lived stuck tabs that are its whole reason for
> existing. Assume the residual population is never zero, keep it enumerable, and accept that its
> last mile is a human being sending a message.
