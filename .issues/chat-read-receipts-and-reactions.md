# Chat: read receipts + emoji reactions (Living first, then port to house)

Build in **Living** (`/chat`), then port to house (`/team`) once Jacob is happy.

## Decisions (from interview)
- **Read receipts:** unified "read bubbles" across BOTH channels and DMs — colored initials
  circles that sit at the last message each *other* member has read (they visually move down as
  people catch up), PLUS a gray text summary under the newest message ("Seen by A, B" for
  channels; "Seen · <time>" for DMs). Reuse existing `chat_room_members.last_read_at` — **no new
  read table**.
- **Reactions:** new `chat_reactions` table. Quick set (👍 ❤️ 😂 🎉 👀 ✅) shown on hover + a "＋"
  that opens a homegrown ~80-emoji curated palette popover (NO search, NO dependency). Reaction
  chips under each message with counts; click a chip to toggle yours.
- **Poll:** switch the per-room message poll from append-only (`after=cursor`) to reconciling the
  recent window — refetch recent messages (with reactions + read positions) each tick and
  merge/replace, so reactions/edits/deletes/read markers all stay live.
- **No external notifications** for reactions (in-app only; don't mark a room unread).
- **Naming:** Living already says "Chat" everywhere user-facing — nothing to rename here. The
  Team→Chat label rename (keep `/team` URL for email links) happens during the house port.

## Data model facts
- Chat tables live in `shared.db`, server-only, reached only via `/api/chat/*` (never synced).
  Created on clients too but stay empty.
- Migrations auto-globbed + applied on server (`shared-db.ts`) AND admin clients (`client/db.ts`)
  in sorted order; `latest_*_migration_name` derives from the same glob. New file just works.
- `chat_room_members.last_read_at` written on message fetch (view) + on send. Already powers
  unread counts. This IS the read position.

## Living — ✅ COMPLETE (2026-07-08)
Migration `shared-migrations/20260708_chat_reactions.sql`; `chat-db.ts` (`toggle_reaction`,
`attach_reactions`, `get_room_read_positions`, reactions hydrated into `get_room_messages`,
`delete_room` cascade); `/api/chat/react` toggle endpoint; messages endpoint returns
`read_positions`; `$lib/chat/` (`read-receipts.ts`, `emoji-data.ts`, `reaction-picker.svelte`,
`read-bubbles.svelte`); `chat-message-item.svelte` reaction chips; `/chat/+page.svelte` reconcile
poll + bubbles + seen summary; stories. Verified (72 chat tests, check/lint clean, two-user e2e).

## REMAINING — Port to house (after Jacob signs off on Living)
- Rename "Team" label → "Chat" (keep `/team` route). Port reactions + read receipts.
- house chat lives at house `$lib/db/worker` OPFS model — reactions table + read positions port
  the same way (server-authoritative via /api). Check house's chat schema location before porting.
