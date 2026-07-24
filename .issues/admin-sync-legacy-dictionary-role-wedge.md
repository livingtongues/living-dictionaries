# Recover admin sync from a legacy duplicate dictionary role

The 2026-07-23 production log review found Dr. Greg Anderson's current-build admin mirror halting in
three separate sessions with:

`UNIQUE constraint failed: dictionary_roles.dictionary_id, dictionary_roles.user_id, dictionary_roles.role`

The halt recurred after logging out and back in, so ordinary session renewal does not repair the local
wa-sqlite mirror. Current source already handles newly-created duplicate grants on both sides:

- `process_sync` adopts the server's canonical natural-key owner and echoes a loser tombstone.
- `SyncEngine.#sync_once` applies deletes before upserts and honors an echoed delete for a pushed loser.
- Server and client convergence tests cover that normal round trip.

This production shape is older: a pre-existing local duplicate can be clean/not pushed, so the server
does not know its losing id and cannot echo its tombstone. A full pull then upserts the canonical row
against the still-present local natural key and rolls back forever.

Plan:

- [x] Reproduce a client mirror containing a clean legacy loser plus a differently-id'd canonical
  server role, then prove the current full-resync path halts.
- [x] Before applying a pulled `dictionary_roles` row, detect a different local id owning the same
  `(dictionary_id, user_id, role)` natural key and delete/adopt it when it is clean.
- [x] Preserve a dirty local collision unless the same sync response authoritatively supersedes it.
- [x] Add an engine-convergence regression test for the pre-existing clean-loser shape.
- [ ] Verify Greg's admin mirror resumes syncing on the deployed build; do not ask him to clear all
  browser storage unless targeted convergence cannot safely repair it.

Implementation is complete and focused tests pass. Production verification necessarily remains until
Jacob reviews/commits/deploys this uncommitted fix.

Severity: P2 — current-build admin sync is halted for an active administrator.
