# Phantom `dirty` flags still stuck in ALREADY-POISONED browsers

Follow-up to `.issues/yokoim-dirty-rows-stuck-2026-07-20.md` (dict DBs) and the shared.db half in
`.issues/overnight-2026-07-26-execution.md`. Both of those fixed the **server** and the **snapshots**.
Neither can reach a browser that already downloaded a poisoned copy.

## The gap

The 2026-07-26/27 work closed four holes: the source (`dedup-labels.ts`), the merge path, the pull
path, and the snapshot copy. Verified clean server-side:

```
boienen-old-buhi-langua: server-side dirty = 0
mahasuvi:                server-side dirty = 0
batsi-kop-tsotsil-tsot:  server-side dirty = 0
```

But `dirty_rows_stuck` is STILL firing from production browsers — most recently
**2026-07-27T04:08Z**, hours after the drain. The reason is structural:

- a client's OPFS copy of the dict DB is only replaced when it re-fetches a snapshot; a healthy
  client boots from the local copy it already has;
- the pull path nulls `dirty` on **incoming** rows, but a row that is already in sync never comes down
  again (`server_seq > cursor` never matches it), so a locally-flagged row is never revisited;
- the holder is typically a **viewer** with no editor role, so it can never push the row and clear the
  flag that way — the original trap.

Net: those browsers warn every 30 minutes forever, and the alarm that should mean "a real editor's
writes aren't draining" keeps crying wolf.

## Size (production, `dirty_rows_stuck`, last 7 days)

| dictionary | events | sessions | rows reported | last seen |
|---|---:|---:|---:|---|
| boienen-old-buhi-langua | 123 | 6 | 2 | **2026-07-27T04:08Z** (still live) |
| algonquin | 69 | 0 (anon) | 39 | 2026-07-22 |
| mahasuvi | 31 | 10 | 116 | 2026-07-26 |
| yokoim | 8 | 1 | 44 | 2026-07-21 |
| mising | 5 | 1 | 1 | 2026-07-23 |
| batsi-kop-tsotsil-tsot | 4 | 2 | 2146 | 2026-07-25 |
| iipay-aa | 1 | 0 (anon) | 2 | 2026-07-20 |

Mostly anonymous viewer sessions; a handful of signed-in users. Bounded and shrinking (each entry
stops once that browser's local copy is replaced), but `boienen` shows it does NOT resolve on its own
for a returning visitor.

## RESOLVED 2026-07-27 ✅ — option 2 (server-vouched reconcile), not option 1

Option 1 (the recommendation below) was **rejected on implementation**: "a non-editor's flags are
phantom" is not safe. A contributor whose login or role lapsed AFTER writing is also a non-editor
holding dirty rows, and the engine's own watchdog already calls that the most dangerous variant. In a
language-documentation app the lost row is irreplaceable, so the engine must never decide this
locally.

What landed instead — the client ASKS and the server VOUCHES:

- **Request** `dirty_probes: { table: [{ id, updated_at }] }` — read-only, viewer sessions only
  (editors' flags drain through the real push path). Capped at `MAX_DIRTY_PROBES` (500), which lives
  in the CLIENT-SAFE `dict-syncable-tables.ts`, not the server module — a value import from the
  server file drags better-sqlite3 into the client bundle (that file's header documents the crash).
- **Response** `redundant_dirty: { table: [ids] }` — ids where `canonical.updated_at >=
  local.updated_at`, i.e. pushing could add nothing. Everything else stays flagged: a row the server
  has never seen, or holds an older copy of, is genuine pending work.
- **Client** clears only ids it actually probed (a row written during the round-trip can't be caught
  by a stale verdict), then ships `dirty_flags_reconciled` (info) with the count.
- **Cadence**: probe once per session (poisoned browsers carry the flags at boot, so the first sync
  heals them), re-armed by the stuck watchdog only when the dirty count CHANGED, and re-armed after a
  successful drain so a capped batch finishes across syncs.

### The bug the browser test caught that unit tests could not

`/changes` **fast-bails** when there is nothing to push and nothing new since the cursor — and a
poisoned pull-only client is BY DEFINITION fully caught up, so it hit that bail every single time and
the probe was silently dropped. Exactly the same trap as the documented "fast-bail must not drop
pushes when `cursor == watermark`" rule, one row down. Fixed by including `has_probes` in the bail
test. **Only the real-browser e2e surfaced this** — every unit test called the helper directly and
never went through the endpoint.

### Verification

- Server: 7 tests (redundant / newer-server-copy / **real work never swept** / unknown row / probes
  are read-only, touching no row, no tombstone, no `server_seq` movement / no probe → no verdict /
  budget cap). Sabotaging the `updated_at` comparison makes the "real work" test fail.
- Client: 8 tests (probes sent, verdict applied, unvouched flag survives, mid-flight write untouched,
  editors never probe, clean viewer sends nothing, once-per-session, re-arm after a drain, telemetry
  shape). Sabotaging the editor/arm guard fails 4.
- **Real browser, real server** (`/tmp/e2e-reconcile-safety.mjs`): boot as editor so the snapshot
  comes from the dev server, drop to anonymous, plant TWO dirty rows side by side — `e_ja` (server
  has it) and `local_only` (server never saw it) — reload. Result: `still dirty: ["local_only"]` with
  its content intact, and `dirty_flags_reconciled {cleared: 1}` in `logs.db`. The phantom died; the
  work lived.
  - Dev gotcha worth knowing: dev VIEWERS download the PRODUCTION R2 snapshot while syncing against
    localhost, so their rows don't exist on the dev server and NOTHING is vouched for. The first
    attempt "failed" for that reason alone — boot as an editor first (its snapshot comes from
    `/api/dictionary/[id]/db`) and then drop to anonymous on the same OPFS file.

## Options (as originally proposed — kept for the record)

1. **Client-side one-time sweep (recommended).** On boot, for a session with **no editor role on this
   dictionary**, `UPDATE … SET dirty = NULL WHERE dirty IS NOT NULL` across the syncable tables. A
   non-editor's flags are phantom BY DEFINITION — it has no push path, so there is no local work to
   lose. Cheap, self-limiting, no server involvement.
2. **Reconcile on the stuck signal.** When the engine is about to warn `dirty_rows_stuck`, ask the
   server whether those ids are actually pending; clear the ones the server considers canonical.
   Precise but chattier, and needs a new endpoint.
3. **Force a snapshot re-fetch** for affected dicts (bump the snapshot version so clients re-download).
   Heavy — makes every visitor re-pay a cold download to fix a flag.

Option 1 handles every anonymous/viewer case in the table above. An EDITOR holding genuinely-unpushed
work must NOT be swept — that is exactly the signal the alarm exists for, so gate strictly on role.

## Verification if implemented

- A dict DB seeded with `dirty = 1` rows + a viewer session → boots clean, no warn.
- The same seeded rows + an **editor** session → flags PRESERVED and pushed (regression guard).
- Watch `dirty_rows_stuck` for `boienen-old-buhi-langua` (the one still live) after deploy.

## Notes

- The enriched context (`tables`, `has_editor_role`, `oldest_dirty_updated_at`) added 2026-07-27 is
  still **uncommitted**, so all production events above are old-format (`undefined` for those fields).
  After deploy, `has_editor_role` alone will separate phantom from genuine at a glance — worth
  re-reading the signal then before building anything.
