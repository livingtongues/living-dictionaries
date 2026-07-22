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
- [ ] Verify on Android Chrome and iOS Google-app/Safari contexts; ensure one bad dictionary file does not affect others.
- [x] Emit one terminal/recovered event per session instead of an unbounded re-election log loop. ✅ `dict_boot_recovery_exhausted` / `dict_boot_recovered`.

Severity: P2 for signed-in editors or persistent current-build recurrence; otherwise P3/watch for isolated anonymous embedded-browser sessions.
