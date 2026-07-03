# Admin backend — house feature port (2026-06-25)

LD's `/admin` borrows heavily from `~/code/house`'s admin backend. Several modules are
**near-byte-identical across the two repos by design** — when you patch one, port the fix to
the other. This page records what mirrors house and the LD-specific divergences (the *why*
that isn't obvious from a single file).

## Schema graph — hand-rolled canvas (xyflow dropped)
`routes/admin/schema/graph/{schema-graph.svelte,table-node.svelte,graph-toolbar.svelte,graph-geometry.ts}`
were ported from house's 2026-06-10 rewrite that **replaced `@xyflow/svelte` (~150KB)** with a
hand-rolled CSS-transform pan/zoom canvas + SVG edges. `build-graph.ts` (dagre layout +
junction/derived heuristics) was already the house-compatible version in LD.

- `graph-geometry.ts`, `schema-graph.svelte`, `graph-toolbar.svelte` are **verbatim from house** —
  keep in sync.
- `table-node.svelte` differs in ONE spot: the `/admin/data` "data" deep-link is removed (LD has
  no `/admin/data` row browser — Jacob said house's wasn't good enough yet).
- `+page.svelte` is LD-specific: **4 source tabs** (server shared.db / server dictionary.db / local
  admin.db / paste) vs house's 3, because LD has per-dictionary DBs. The Cards view was dropped
  (Q1: graph-only). Focus lives in `?table=` (browser-back exits focus); switching source clears it.

## Chat (/chat) — server-authoritative, NOT synced, membership-based
`lib/server/chat/*`, `lib/chat/*`, `routes/api/chat/*`, `routes/chat/+page.svelte`,
`lib/db/server/chat-reping-cron.ts`. Originally a port of house's admin team chat; **2026-07-03 it
moved OUT of /admin to the standalone `/chat`** so non-admin members (super managers, partners) can
participate — LD has diverged from house here (house's is still admins-only under /admin).

Key design facts:
- Chat tables (`chat_rooms`, `chat_room_members`, `chat_messages`, `chat_attachments`,
  `admin_presence`) are **server-only**: created-but-empty on admin clients, have **no `dirty`
  column**, and are **absent from `SYNCABLE_TABLE_NAMES`** → the sync engine never touches them.
  Privacy: DMs + private channels must never land in a non-member's local wa-sqlite DB.
  Served only through the membership-filtered `/api/chat/*` endpoints + a 5s poll.
- **Access gate = member of ≥1 room** (`gate_chat`), NOT an admin-level check. Page entry rides on
  `AuthUserData.is_chat_member` (SSR, no extra nav round-trip); endpoints re-check fresh.
- **All channels are DB rows** (FIXED_CHANNELS is gone — Jacob 2026-07-03: "cleaner in the long
  run"). Admins (≥2) create/rename/delete channels + add/remove members in the /chat UI;
  `chat_rooms.admin_room = 1` rooms (the four originals) are manageable **only by super admins
  (level 3)**. The two SYSTEM rooms (`all-admins`, `notifications`) are boot-seeded
  (`ensure_all_admins_in_team_chat`) with every allow-list admin and can never be deleted;
  `notifications` stays admins-only (platform telemetry — don't add partners).
- **Directory = people who share a room with you** (`list_chat_directory`), which also scopes who
  you may DM (`shares_room` enforced server-side). Names resolve from `users.name` → email.
- **Non-admin members always get EMAIL pings** (`notify_chat_member`); allow-list admins keep their
  ntfy/email `notify_channel` pref. Same one-ping-per-unread-batch policy + 1-day gentle reping
  cron for everyone. Message `body_html` is **sanitized server-side with `xss`** at post/edit —
  required now that non-admins author messages rendered via `{@html}`.
- Presence heartbeat runs only on /chat + inside /admin; the rooms/unread poll runs site-wide for
  members (root layout → avatar dot + UserMenu badge). A member browsing elsewhere still gets
  email pings — deliberate.
- `/admin/team` 301-redirects to `/chat` (old deep links in emails keep working).
- The four byte-identical harness files house/LD warns about (db worker) are unrelated to chat;
  chat is its own server-authoritative layer.

## notify_channel + targeted pings
`users.notify_channel` ('email' | 'ntfy', migration `20260625c`) lets each admin choose where
TARGETED pings (message assignment + chat) land. `notify_admin` (in `notify-admins.ts`,
upgraded to house's version) reads it server-side; `notify_chat_member` wraps it for chat so
non-admin members fall through to plain email. The column **rides to admin clients via the
existing download-only directory sync** (`VALID_COLUMNS` is auto-derived from the drizzle schema,
so no sync-config change was needed) and is flipped via `/api/admin/set-notify-channel`. The
broadcast `notify_admins` (new-inbound) stays ntfy-only, and **skips off-duty admins**
(`admins.ts` `Admin.notify === false`) — they keep admin + chat access but get no broadcast pings or
chat re-pings (Anna, from 2026-06-27).

## Message triage (matching, not AI)
`/admin/messages/unmatched` + `/api/admin/match-thread-to-user` (ports of house) let an admin
point a `from_user_id IS NULL` thread at the right user — stamps `from_user_id`, backfills NULL
customer messages, and inserts an `email_aliases` row (`source='inbound-match'`) so future mail
auto-resolves. The **AI triage pipeline** (LLM classification of inbound) was subsequently built
(`42099efa`, env-gated on `XAI_API_KEY`) — see `ai-triage-pipeline.md`.

## Compose email (2026-07-03 port)
`lib/admin/messages/{compose-email-modal,compose-recipients,recipient-input,cc-bcc-fields}.svelte`,
`resolve-compose-recipient.ts`, `/api/messages/compose`, and the supporting utils
(`parse-email-list`, `is-image-mimetype`, `paste-image-from-clipboard`, `StagedImageThumb`,
`RichTextEditor` incl. `should-autolink`) are **near-verbatim from house** — keep in sync. LD
divergences: `ld_address` instead of `hvsb_address`, `@livingdictionaries.app` Message-IDs,
svelte-pieces live at `lib/svelte-pieces/*` (no `ui/` subfolder for Modal/RichTextEditor), and
the set-name endpoint is `/api/admin/users/[id]/name` (LD's nested convention) vs house's flat
`/api/admin/set-name`. `messages.cc/bcc` columns were added in `20260703a_message_cc_bcc.sql`
(mirrors house's `20260624a`).

## Shared-infra additions made during the port
- `ResponseCodes.PAYLOAD_TOO_LARGE = 413` (`lib/constants.ts`).
- `log_errors?: boolean` option on `post_request`/`get_request` (`lib/utils/requests.ts`) — set
  `false` on background polls so a transient redeploy network blip doesn't spam the console.
- Ported pure utils from house: `lib/utils/text-to-html.ts`, `lib/utils/linkify-html.ts`,
  `lib/r2/get-attachment.ts`.
