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

## Tasks — DONE (Living)
- ✅ Migration `shared-migrations/20260708_chat_reactions.sql` (+ index).
- ✅ `chat-db.ts`: `toggle_reaction`, `attach_reactions` (batched), `get_room_read_positions`;
      extended `ChatMessageWithAttachments` with `reactions`; `get_room_messages` hydrates reactions.
      Types `MessageReaction`, `RoomReadPosition`. `delete_room` also cascades `chat_reactions`.
- ✅ `/api/chat/react` POST toggle endpoint (+ `_call.ts` + `server.test.ts`).
- ✅ Messages endpoint returns `read_positions` too.
- ✅ `$lib/chat/read-receipts.ts` pure helpers (+ inline vitest).
- ✅ `$lib/chat/emoji-data.ts` curated palette (quick set + ~90 across 5 categories).
- ✅ `$lib/chat/reaction-picker.svelte` (quick set + ＋ palette, clickoutside).
- ✅ `$lib/chat/read-bubbles.svelte` (stacked initials, +N collapse, name tooltip).
- ✅ `chat-message-item.svelte`: reaction chips + react affordance on ALL messages.
- ✅ `/chat/+page.svelte`: reconcile poll, read_positions state, bubbles per boundary + seen summary.
- ✅ Stories: read-bubbles, reaction-picker; chat-message-item WithReactions.
- ✅ Verified: `pnpm vitest` (72 chat tests pass), `pnpm check` (0 errors), `pnpm eslint` clean,
      + two-user headless e2e (bubble moves mid-thread→last msg, "Seen by" summary, live reaction
      chip, zero page errors).

## Port to house (later, after Jacob signs off)
- Rename "Team" label → "Chat" (keep `/team` route). Port reactions + read receipts.
- house chat lives at house `$lib/db/worker` OPFS model — reactions table + read positions port
  the same way (server-authoritative via /api). Check house's chat schema location before porting.
