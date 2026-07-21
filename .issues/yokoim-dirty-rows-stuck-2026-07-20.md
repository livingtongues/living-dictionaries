# Yokoim editor has 44 dirty rows stuck

## Production evidence — 2026-07-20

- One real signed-in editor session on `yokoim` reported `dirty_rows_stuck` five times from 17:37 through 19:50 UTC.
- The count remained exactly **44 dirty rows / 0 deletes** for more than two hours.
- `last_sync_at` kept advancing and `last_error` stayed null, so the sync loop was alive but was not clearing these specific rows.
- The editor is deliberately unnamed here; resolve the user from telemetry only if direct outreach is needed.

## Follow-up

- [ ] Re-query the next production window for this session/dictionary. If the 44-row signal persists, reconstruct the preceding `entry_created` / push activity and inspect the server dictionary DB for the affected row IDs.
- [ ] If rows are still stuck, contact the editor before asking them to close/reload the tab so any recoverable local work is preserved.
- [ ] Determine why a successful sync timestamp can advance without clearing these rows; verify dirty flags are cleared only by acknowledged pushed row IDs, per the sync invariant.

