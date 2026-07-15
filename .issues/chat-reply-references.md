# Chat: Discord-style reply references + load-older pagination

## STATUS: built + verified (tests/types/lint/check/visual). Live smoke test on tuf pending.
- ✅ All steps 1–10 implemented.
- ✅ `vitest` chat suite: 54 pass (incl. new reply-preview + before-paging + cross-room reject).
- ✅ `tsc --noEmit` clean · `eslint` 0 errors · `svelte-check` 0 errors.
- ✅ svelte-look screenshots (light+dark): reply quote-line (text/photo/file/deleted) + composer reply bar.
- ⏳ NOT yet exercised live in a browser: the client wiring (jump-backwards loop, load-older
  scroll-preservation, poll reconcile keeping older pages). Needs a run on tuf (dev server +
  a room with >100 messages) to confirm end-to-end. Everything else is green.


Add the ability to reply to a specific earlier message in /chat, rendered Discord-style:
a compact clickable quote-line above the reply that jumps to (and briefly flashes) the
original. NOT Slack sub-threads — everything stays in the linear timeline.

Bundled with **load-older pagination** because the "jump to a referenced message that's
scrolled off" flow depends on being able to page backwards through history.

## Decisions (settled with Jacob)
- **Discord-style single reply reference** (one `reply_to_message_id`, no threads).
- **Live-resolve the preview on the server** — join the referenced row on every fetch,
  return author + current text snippet + a deleted flag (reflects edits/deletes).
- **Load-older pagination**: a **"Load older messages" button pinned at the top** of the
  thread (not infinite scroll).
- **Deep jump**: when the referenced message is above the loaded window, **page backwards
  in a loop** (reusing the load-older path) until it's found, with a safety cap, then
  scroll + flash. No dedicated "context window" endpoint.
- **Non-text preview**: icon + label ("📷 Photo" for an image, the filename for a file).
- Notifications unchanged — a reply pings the room exactly like any other message.

## Current architecture (as-found)
- `chat_messages` is a flat table (no parent linkage). Client loads newest
  `MESSAGE_PAGE_LIMIT = 100` per room, no load-older yet.
- Poll (`poll_messages` → `reconcile_messages`) **refetches the newest 100 window every
  ~3s and REPLACES the list** with `[...incoming, ...pending]`. This is the key wrinkle:
  naive load-older pages would be wiped by the next poll.
- `get_room_messages({ after })` supports an ascending `after` cursor (unused by the poll,
  which refetches the whole window) + the default newest-DESC-then-reversed initial load.
- Server helpers: `post_message`, `attach_attachments`, `attach_reactions`,
  `get_room_messages`, `edit_message`, `delete_message` in
  `site/src/lib/server/chat/chat-db.ts`.
- Endpoints: `/api/chat/messages` (GET, marks read), `/api/chat/send`, `/api/chat/edit`.
- UI: `site/src/routes/chat/+page.svelte`, `chat-message-item.svelte`, `chat-composer.svelte`.

## Plan

### 1. Migration — `20260715_chat_reply_to.sql` ✅
`ALTER TABLE chat_messages ADD COLUMN reply_to_message_id TEXT;` (nullable, no FK — SQLite
ALTER can't add FKs; validated in app code). Auto-discovered by the `import.meta.glob`
migration loader; sorts after `20260715_chat_access.sql`. Runs on server shared.db + admin
clients (chat tables exist there, unsynced).

### 2. `chat-db.ts` ✅
- `ChatMessageRow` gains `reply_to_message_id: string | null`.
- New `ReplyPreview` interface: `{ message_id, author_user_id, snippet, deleted, attachment: { is_image, filename } | null }`.
- `ChatMessageWithAttachments` gains `reply_to: ReplyPreview | null`.
- `post_message` accepts optional `reply_to_message_id`; validates the target exists **and
  is in the same room** (reject cross-room refs), else ignore/400.
- `attach_reply_previews({ db, messages })` — batched: collect distinct
  `reply_to_message_id`s, one query for the referenced rows
  (`id, author_user_id, body_text, deleted_at`) + one for their first attachment
  (`is_image`, `filename`), build previews (snippet = body_text trimmed to ~140 chars),
  attach. Wire into `attach_attachments`/`attach_reactions` default hydration so
  `get_room_messages` (and edit endpoint) return it. `attachments: []` default already sets
  reactions; add `reply_to: null` default too.
- `get_room_messages` gains a `before` cursor: `WHERE room_id=? AND created_at<? ORDER BY
  created_at DESC, id DESC LIMIT ?` then reverse (mirrors `after`).

### 3. `/api/chat/messages` ✅
- Accept `before` param → older page. When `before` is present, **skip `mark_read`** (history
  fetch, not a live view). Still returns `read_positions` (harmless).

### 4. `/api/chat/messages/_call.ts` ✅
- Add optional `before`.

### 5. `/api/chat/send` + `_call.ts` ✅
- `ChatSendRequestBody` gains optional `reply_to_message_id`; pass into `post_message`.

### 6. `/api/chat/edit` ✅
- Add `attach_reply_previews` to the hydration pipeline so an edited message keeps its
  reply preview.

### 7. `chat-message-item.svelte` ✅
- New props `on_reply(message)` and `on_jump(message_id)`.
- Render `message.reply_to` as a clickable quote-line above the body: accent bar, author
  name, snippet (or 📷 Photo / filename / "message deleted"). Click → `on_jump`.
- Add a "Reply" button to the hover-actions row (mdi/reply).

### 8. `chat-composer.svelte` ✅
- New props `replying_to: ChatMessageWithAttachments | null` + `on_cancel_reply()`.
- Render a "Replying to {author}" bar above the editor with the snippet + an ✕ cancel.
- `on_send` payload gains `reply_to_message_id`.

### 9. `+page.svelte` ✅
- State: `replying_to`, `has_more_older`, `loading_older`.
- **Reconcile refactor** — keep older history that predates the live window:
  `messages = [...older_than_window, ...incoming, ...pending_optimistic]`, merging the live
  window by id. Prevents polls from wiping loaded history.
- `has_more_older = loaded.length === MESSAGE_PAGE_LIMIT` on initial load; set false when a
  `before` page returns < limit.
- **Load-older button** pinned at top (shown when `has_more_older`): fetch
  `before = messages[0].created_at`, prepend, **preserve scroll position** (record
  scrollHeight before, restore delta after `tick`).
- `on_reply` sets `replying_to`; `send` includes `reply_to_message_id` and clears it.
  Optimistic just-sent message synthesizes `reply_to` locally from `replying_to` (server
  version replaces it on next reconcile).
- `jump_to(message_id)`: if element present → scroll + flash; else loop load-older (cap ~20
  pages) until present or top reached, then scroll + flash. Flash = temporary CSS class.

### 10. Tests ✅
- `chat-db.ts` inline/vitest: reply preview resolves author+snippet; deleted flag; non-text
  attachment label; same-room validation rejects cross-room ref; `before` pagination returns
  the right older slice.

### 11. Verify
- `pnpm test`, `pnpm exec tsc`, `pnpm lint`, `pnpm check`.
- svelte-look stories for `chat-message-item` (with reply_to variants) + `chat-composer`
  (replying_to variant); screenshot-verify.

## Notes / gotchas
- Chat tables are server-only (never a sync sector) — no dirty columns, safe ALTER.
- `body_text` is the plain-text mirror; snippet from it (not body_html).
- Keep SQL keywords ALLCAPS; snake_case; options-object args.
</content>
</invoke>
