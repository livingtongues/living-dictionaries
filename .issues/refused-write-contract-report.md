# Refused-write contract — completion report (living-dictionaries)

Plan: <File path=".issues/refused-write-contract.md" />. All three items implemented, **everything left
uncommitted**. Note the working tree also carries an unrelated in-flight `lib/` layout-convergence
refactor (another agent) — none of my files overlap it.

## Item 1 — bulk actions bypassed the guarded write facade ✅

- **`guarded-writes.ts`**: added `set_sources` + `set_review` as thin `guard(...)` wrappers. Both
  return a value on success so a caller can tell "written" from "refused" (`guard` resolves
  `undefined` when it swallows).
- **New `entries/table/bulk-actions.ts`**: the two loops moved out of the component as
  `apply_bulk_source` / `apply_bulk_review`. They go through the facade, paint `entry.main.… =`
  **only after** the write resolves, continue past a refusal, and return `{ written, refused, skipped }`.
- **`BulkActionBar.svelte`**: calls those two; the `dict_db?.` optional chain is gone (the component
  no longer touches `dict_db` at all).

Why a separate module: there is no component-render test infra in this repo, and the ORDER (write
→ then paint) is precisely what needed locking down. As plain functions it is directly testable.

Behaviour now matches the four sibling actions: readiness check, `write_blocked` telemetry, error
toast, continue-on-failure — and a null `dict_db` refuses **every** entry instead of resolving as
success for all of them.

## Item 2 — a NULL field value killed the save silently ✅

Three halves, per the review:

1. **Boundary** — <File path="site/src/lib/components/entry/EditFieldModal.svelte" /> now types
   `value?: string | null` and passes `value={value ?? ''}` down. This is the single door to
   `EditField` for all five call sites (entry page, table cell, AddEntry, AddSentence, text reader),
   so it is strictly wider than normalizing in `EntryField` alone — `EntryField` and the table's
   `Textbox` also had their prop types corrected to `string | null` (they were lying).
2. **`save()` is null-proof** — new <File path="site/src/lib/components/entry/edit-field-value.ts" />
   holds `resolve_field_save_value` (input element wins, then the bound prop, then `''` — never
   `.trim()` on a null) and `save_field_value` (the whole save orchestration).
3. **Failure is visible + countable** — a rejected `on_update` no longer escapes: it emits
   `write_blocked` with `reason: 'edit_field_save_failed'` **and the `field` name**, toasts
   `misc.save_failed`, and leaves the dialog open. Previously it reached `Form.svelte`'s
   `alert(err)` with a raw `TypeError` string.

Also fixed while in there: `{#if value.includes('<i>')}` in the `scientific_names` branch would
throw on a null value during render.

## Item 3 — sync-rejection contract ported ✅

**New <File path="site/src/lib/db/sync/rejected-rows.ts" />** — the shared contract: `RejectedRow`,
`group_rejected_rows` (one group per table+reason, exact `count`, id sample capped at 20),
`resolve_rejected_rows` (prefers `rejected_rows`, falls back to legacy `skipped_orphans`),
`summarize_rejections`, the throttle, and the reason→i18n-key map.

### Server (additive — `skipped_orphans` kept)

Only reasons whose code paths actually exist here:

| reason | shared.db (`sync-helpers.ts`) | dict.db (`dictionary-sync-helpers.ts`) |
|---|---|---|
| `orphan` | FK-recovery skip | FK-recovery skip |
| `duplicate` | natural-key owner adoption (loser id) | `deduped_losers` |
| `tombstoned` | tombstone-resurrection guard | — *(no such guard here; not emitted)* |
| `unauthorized` | push to a `READONLY_TABLES` table (`users`) | `is_editor === false` |

Both endpoints now also log a server-side `admin_sync_push_refused` / `dict_changes_push_refused`
warn per group — the half that survives a closed browser.

### Client

- Both engines call `resolve_rejected_rows` on the response, emit **`sync_push_rejected`** at
  **error** level with `{ engine, sector, reason, table_name, count, ids }` (admin: `log_event`;
  dict: a new worker-safe `report_dict_push_rejected`, since the leader worker has no localStorage
  buffer), and fire a new `on_push_rejected` callback. The existing `log_tail` line is untouched.
- **Toast**: dict → `on_push_rejected` → instance broadcasts `{ type: 'push_rejected' }` → the
  `subscribe_sync_sentinels` handler in `dict-session.ts` toasts (same channel `sync_halted` uses);
  admin → `on_push_rejected` wired in `admin/+layout.ts`. Copy:
  *"N of your changes couldn't be saved — <reason phrase>"* (`misc.push_rejected` + one phrase key
  per reason, EN only — the rest come from the DB at deploy).

## Two things worth flagging

1. **The dict `unauthorized` case needed the endpoint, not just the helper.** `has_push` is
   `is_editor && …`, so a non-editor's push never reaches `process_dict_changes` when the fast-bail
   applies (`cursor === counter`, the common case). `collect_unauthorized_push_rejections` is
   exported and called from **both** the fast-bail branch and `apply_dict_changes`. This is the
   highest-value reason of the four: a contributor whose role lapsed mid-session is exactly the
   "editing into a void" case, and it was 100% silent before.
2. **I added a throttle the spec didn't ask for, and it is load-bearing.** Nothing clears an
   `unauthorized` (or permanently-orphaned) refusal, so the identical rejection returns on every
   30-second tick. Un-throttled that is a toast every half minute and ~2,880 identical telemetry
   rows a day from one wedged editor — the same anti-pattern the `dirty_rows_stuck` and
   `boot-give-up` throttles exist for. `should_report_rejections` suppresses an identical signature
   for 10 minutes; a *changed* signature always reports.

## Verification

| Check | Result |
|---|---|
| `npx vitest run` (full) | **2626 passed, 4 skipped, 351 files** |
| `npx tsc --noEmit` | clean |
| `pnpm check` (svelte-check) | **0 errors** (50 pre-existing warnings) |
| `npx eslint` on every touched/new file | 0 errors (pre-existing warnings only) |
| `pnpm build` | succeeds, build-version stamp check passes |
| `pnpm test:sync` (live e2e) | **✅ PASS** — browser wa-sqlite edit → `POST /api/dictionary/[id]/changes` → server SQLite → fresh no-OPFS browser read, no uncaught page errors (after the three harness fixes below) |

New/updated tests:

- `entries/table/bulk-actions.test.ts` (5) — drives the **real** `create_guarded_writes` facade:
  paint-after-write, a mid-loop refusal leaves that row untouched + toasts + the loop finishes, and
  a null `dict_db` refuses every entry with `write_blocked`.
- `components/entry/edit-field-value.ts` inline (6) — NULL column value saves `''` and closes; a
  rejected update reports `{ field, error }` and keeps the dialog open.
- `db/sync/rejected-rows.ts` inline (12) — grouping/cap, legacy fallback, summary, throttle.
- `dict-sync-engine.test.ts` (+4) — one event per (table, reason) with the tab summary; legacy
  `skipped_orphans`-only server; repeat suppression; clean round trip silent.
- `engine-convergence.svelte.test.ts` (+3) — **end-to-end through the real `process_sync`**: a
  tombstoned push reports `tombstoned`, a natural-key duplicate reports `duplicate`, a clean push
  reports nothing.
- `dictionary-sync.test.ts` (+2) / `sync-helpers.test.ts` (+1) — server emits `orphan`, `duplicate`,
  `unauthorized` (non-editor push, and readonly-table push).

**Live browser verification** (real `pnpm build` output, real `node build`, puppeteer, seeded dev
dictionary, logged in as the non-admin manager):

- The phonetic field editor opens with the stored value, **zero console errors**.
- Typing a marker and clicking Save → the marker renders on the entry page, **no failure toast, no
  console errors** — i.e. `save_field_value` saves exactly as the old inline `save()` did.
- `svelte-look` screenshot of a new `EditFieldModal` **NullValue** story (`value: null`) — renders an
  empty editor in light + dark instead of throwing. That story is the regression guard for §1.2's
  exact shape.

## Unrelated things fixed on the way (`pnpm test:sync` was broken before I touched anything)

I wanted a live end-to-end run of the sync path, and the e2e turned out to be unrunnable for three
independent reasons — none of them caused by this work, all now fixed:

1. **The fixture was not idempotent.** `scripts/seed-dev-fixture.ts` uses `INSERT OR IGNORE` for the
   `e_ja` test entry, so the phonetic the e2e overwrites with a unique marker was never reset — the
   *second* ever run bails with *"expected seeded phonetic 'haʔ', got …"*. One-line
   `UPDATE entries SET phonetic = 'haʔ'`.
2. **The test clicked before hydration.** `Add Audio` is in the SSR HTML, so it proves nothing about
   the app being interactive; one click on inert markup, then a 30s wait for a modal that never
   opens. Now waits for the dict connection and retries the click.
3. **The script never exited, so even a PASS looked like a timeout.** The self-booted `node build`
   holds cron timers and open SQLite handles and ignores `SIGTERM`, so its stdio pipes kept the test
   process alive after the ✅ banner printed. Teardown now `SIGKILL`s it and exits with its own code.
   **`e2e/dev-flow.mjs` and `e2e/dict-delete-2tab.mjs` copy the same teardown and have the same
   hang** — I left them alone because I haven't run them, but it is the same two lines.
4. **The test saved into the still-loading window — and the app correctly refused it.** With the
   console handler fixed to serialize `Error` args (it printed a useless `JSHandle@error` before),
   the cause named itself:

   ```
   [console.error] Error: Wait until loading spinner stops to make edits.
                   at Object.check_ready (…)
   ```

   That is the guarded write facade doing exactly its job — a `write_blocked` row plus a toast — and
   it is a **nice independent confirmation of the property this whole task is about**. The edit +
   save is now a retry loop that waits the window out.

With those three fixed, `pnpm test:sync` **passes**. A useful sanity check on scope while debugging:
the same flow driven by hand in a real browser (an 8s settle before editing) saved cleanly with zero
console errors and no failure toast, which is what ruled my changes out as the cause before I touched
the harness.

Files: `site/scripts/seed-dev-fixture.ts`, `site/e2e/dict-sync.mjs`. Say the word if you'd rather
these two live in a separate commit from the contract work.
