# Recover persistent OPFS dictionary boot failures

Production review on 2026-07-21 found current-build, human-browser dictionary boot failures that exhaust the three fast retries and then keep re-electing the same poisoned local database:

- Ngemba (`dict_id: ngəmba`): 15 `leader_boot_failed` rows in one anonymous Android Chrome session. The local migration repeatedly fails with `duplicate column name: discourse_role`. The authoritative server DB is healthy and records `20260714_structured_grammar.sql` as applied, so the browser OPFS copy is partially migrated: the column exists but its migrations row does not.
- `sqlite3_open_v2`: 51 rows across current-build human sessions, including a signed-in Olukumi user and anonymous Sengwer/Aghul/Eyak/Tjwao/Apatani visitors. Some may be unsupported Google-app browser behavior, but repeated failure is terminal for that dictionary in the session.
- Current recovery in `site/src/lib/db/dict-client/worker/db-client.ts` retries and re-elects indefinitely. It does not replace/reset a persistently broken local OPFS file from the server snapshot.

Plan:

- [x] Distinguish persistent local-file/schema failures (`duplicate column`, malformed/open failures) from transient worker/network/deploy failures. ✅ Terminal exhaustion/recovery events now separate the bounded outcome from per-attempt warnings.
- [x] After a bounded retry budget, preserve the affected OPFS dictionary file unless durable acknowledgement proves reset safe. ✅ Unreadable files are never deleted because their dirty state cannot be proven; reset flushes push-only and refuses while pending work remains.
- [x] Make client migration application atomic per file, and make additive migrations safely resumable after a partial application. ✅ Existing columns are skipped only after exact type/nullability postconditions match; remainder + marker share one transaction.
- [x] Add tests for partial additive migration repair/refusal and atomic server schema+marker rollback. ✅
- [x] **Viewer poisoned-file recovery built (2026-07-22).** `dict-instance.ts` `open_opfs_prepared` now catches an open/migrate failure on an EXISTING file and, for a **viewer** boot, drops the poisoned file + re-fetches a fresh snapshot ONCE (`poisoned_file_recovery_decision`, pure + unit-tested; bounded by `poison_recovery_attempted`). Editors are preserved (un-pushed writes can't be probed on an unopenable file). New `dict_boot_file_replaced` (`warn`) telemetry marks a real recovery in the wild. This clears the anonymous/viewer half of the iOS `sqlite3_open_v2` + duplicate-column families — the majority of exhausted sessions.
- [ ] Verify on Android Chrome and iOS Google-app/Safari contexts; ensure one bad dictionary file does not affect others.
- [ ] **Editor recovery (follow-up, bigger change).** A signed-in editor with a poisoned file (e.g. `alclaveria`/`boienen`) is still preserved-and-refused, because we can't prove the un-openable file has no un-pushed writes. To recover editors safely we'd need a DURABLE external write-ledger (a per-dict "has un-pushed writes" marker kept OUTSIDE the dict file — e.g. a tiny sidecar, updated on write/cleared on successful push) so an unopenable file can be judged clean without opening it. Deferred: it's a write-path change with its own consistency/failure modes, out of scope for the provably-safe viewer build.
- [x] Emit one terminal/recovered event per session instead of an unbounded re-election log loop. ✅ `dict_boot_recovery_exhausted` / `dict_boot_recovered`.

Severity: P2 for signed-in editors or persistent current-build recurrence; otherwise P3/watch for isolated anonymous embedded-browser sessions.

## 2026-07-22 production check (recovery is live but not yet healing)

The hardening shipped in `d6871c60` (06:08 UTC). Telemetry works: `dict_boot_recovery_exhausted` now fires once per exhausted session with `{dict_id, last_stage, boot_message, attempt, repeat_count}` and BOUNDS the re-election loop (capped at repeat_count 4, then stops — the log-spray is gone). But 24h showed **7 `dict_boot_recovery_exhausted` / 0 `dict_boot_recovered`** — the healing path has not succeeded once:

- **Signed-in iOS `alclaveria@gmail.com` on `boienen-old-buhi-langua`, current build `1784714151639`:** `sqlite3_open_v2` at `opfs_open`, 4 repeats then terminal. The file won't open, so dirty-state cannot be proven, so reset-from-snapshot refuses (correct per the safety invariant) → user locked out of that one dictionary. This user created 5 entries in other sessions, so they are an active editor partly blocked. **This is the open iOS checkbox below.**
- Anon/webdriver `kalinago` + anon `ngabere`: `Failed to fetch dynamically imported module` / `Importing a module script failed.` (stale-bundle worker-chunk fetch during today's 6-build churn). Reset legitimately can't fix a missing code chunk — correctly it doesn't try.

**Decision needed for the un-openable-file case:** a file that fails `sqlite3_open_v2` cannot be opened to read its `dirty` state. Consider allowing reset-from-snapshot when the local file is unopenable AND there is no record of prior local writes for that dict (e.g. no queued push / never-synced marker), since an unopenable clean file has nothing to lose. This is the one modification that would let 0-recovered become >0 for the iOS `sqlite3_open_v2` family.
