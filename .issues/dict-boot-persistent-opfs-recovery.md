# Persistent OPFS dictionary boot failures — remaining open branches

> The bulk of this issue is DONE and proven in production (full history in git): failure
> classification, bounded retries, atomic/resumable client migrations, **viewer** poisoned-file
> recovery (drop + re-fetch snapshot once, page-session-bounded, verified healing on Android
> Chrome `poqomchi` and iOS Safari `iipay-aa`), and session-id correlation for pre-init worker
> telemetry. The stale-build-artifact family got its own fix 2026-07-31 (the reload-once rule,
> `$lib/db/client/stale-build-artifact.ts` + `stale-bundle-recovery.ts`).

## Open (from the 2026-07-30 production check)

1. [x] ✅ **DONE 2026-08-03 (uncommitted)** — **Terminal-event session bound regressed.** One anonymous foreground `bahasa-lani` tab
   emitted **421 `dict_boot_recovery_exhausted` rows over five hours**. Current
   `dict-session.ts` logs every `on_boot_failed` callback whose `will_retry` is false; its
   `recovery_exhausted` boolean controls only the later recovered event, not terminal-event
   emission. Bound this event in the page-session/main-thread lifetime and carry
   `visibility` / `was_hidden` so a future review doesn't need a session replay to prove
   foreground impact. (Check whether the 07-31 reload-once terminal handling already narrows
   this for the stale-artifact reason class — the bound must hold for ALL terminal reasons.)
   **Shipped:** `$lib/db/dict-client/boot-give-up.ts` — `decide_boot_failure_log` bounds rows per
   dict per PAGE SESSION (3 warn / 2 terminal; the new `dict_boot_gave_up` always emits, exactly
   once), and `MAX_BOOT_REELECTIONS` bounds the LADDER itself across worker re-elections, which was
   the actual generator of the volume (bounded retries x unbounded re-elections). `visibility` /
   `was_hidden` + `navigator.storage.estimate()` now ride every shipped row. Measured e2e: 12 boot
   attempts -> 6 rows, and the person now gets a failure card with a reset action instead of an
   endless bar. See `.issues/nightly-fixes-2026-08-03.md` item 2 and
   `.knowledge/db/leader-worker-boot-robustness.md`.
2. [ ] **Editor recovery — the durable external write-ledger branch.** *(2026-08-03: the INTERIM
   answer shipped — an editor whose boot gives up is now ASKED, with a plain-language explanation of
   the tradeoff and a `confirm()`, instead of silently dead-ending on an endless progress bar. The
   sidecar below is still the real fix: it would let us judge an unopenable file clean and skip the
   question entirely.)* A signed-in editor with an
   unreadable local file (e.g. the Iipay Aa contributor who hit two
   `sync_halted_repeated_failure` latches with `database disk image is malformed`; server DB
   integrity `ok`, so browser-local OPFS corruption) is preserved-and-refused because we cannot
   prove the unopenable file holds no un-pushed writes. Needed: a per-dict "has un-pushed
   writes" marker kept OUTSIDE the dict file (tiny sidecar, updated on write / cleared on
   successful push) so an unopenable file can be judged clean without opening it. This is a
   write-path change with its own consistency/failure modes — design first.
   Related: `.issues/future/port-house-corruption-self-heal.md` (house's boot `quick_check` +
   blocking reset modal) is the same family; consider designing them together.
3. [ ] **Contact the affected Iipay Aa contributor** with a cautious recovery path; clearing the
   local file may discard unpushed edits, so do not present it as lossless.

Severity: P2 for signed-in editors; otherwise watch.
