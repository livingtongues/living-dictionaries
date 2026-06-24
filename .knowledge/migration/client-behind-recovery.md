# CLIENT_BEHIND / `schema_outdated` recovery (stale-leader reload loop)

When a deploy ships a new migration, the strict version handshake hard-blocks an older bundle
(`schema_outdated` 409 on dict `/changes`; `CLIENT_BEHIND` 409 on `/api/admin-sync`). The block is
by design; the subtle part is recovery.

## The trap (why a single reload doesn't help)

LD's **dict.db** sync engine runs in ONE per-dict **leader dedicated worker** (`dict-id`-keyed Web
Lock). The leader lives as long as ANY tab on that dict is open. Reloading one tab makes it a
*follower* of the still-alive stale leader → the handshake still reports the old version → loop.
Only closing all of that dict's tabs (or deleting the OPFS DB) frees the lock for a fresh leader.

## Which LD sync paths are affected

| LD sync path | engine runs… | affected |
|--------------|--------------|----------|
| **dict.db** (`dict-sync-engine.ts`) | per-dict OPFS **leader worker** | yes |
| **admin.db** (`engine.svelte.ts`) | main-thread **per-tab** wa-sqlite | no — a reload picks up new code |

## The fix (landed 2026-06-24, cross-repo with house)

- **dict.db** — the existing `schema_outdated` worker broadcast (reaches every tab) now drives a
  **guarded coordinated auto-reload** in `[dictionaryId]/+layout.ts`. All tabs reload → the leader
  tab's worker dies → the lock frees → a fresh leader boots on the new bundle. Its sibling
  `snapshot_expired` deliberately stays a **manual** toast (that's a 60-day-cursor reset, not a
  stale bundle; editors may have un-pushed writes).
- **admin.db** — recovers on any single manual reload (per-tab engine), so it deliberately keeps a
  **manual** toast and does NOT auto-reload — an admin may have un-committed in-progress edits and a
  surprise reload would lose them. (It previously only `console.warn`'d → no cue; now shows a toast,
  matching tutor.)
- Loop guard = `decide_client_behind_recovery()` in `$lib/db/client/client-behind-recovery.ts`,
  **byte-identical to house's** copy (keep in sync): one auto-reload per ~30s sessionStorage window,
  else fall back to the manual toast instead of looping.

Decision (Jacob, 2026-06-24): auto-reload is a last resort, used ONLY where a manual toast can't
escape the multi-tab leader trap. Per-tab-engine apps stay manual to protect un-saved work.
