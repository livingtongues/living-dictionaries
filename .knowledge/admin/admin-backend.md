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

## Team chat — server-authoritative, NOT synced
`lib/server/chat/*`, `lib/admin/chat/*`, `routes/api/admin/chat/*`, `routes/admin/team/+page.svelte`,
`lib/db/server/chat-reping-cron.ts` are ports of house's team chat. Most files are **verbatim or
near-verbatim** — keep in sync with house.

Key design facts (the migration `20260625d_chat.sql` header says most of this):
- Chat tables (`chat_rooms`, `chat_room_members`, `chat_messages`, `chat_attachments`,
  `admin_presence`) are **server-only**: created-but-empty on admin clients, have **no `dirty`
  column**, and are **absent from `SYNCABLE_TABLE_NAMES`** → the sync engine never touches them.
  Privacy: DMs + private named channels must never land in a non-member's local wa-sqlite DB.
  Served only through the membership-filtered `/api/admin/chat/*` endpoints + a 5s poll.
- **LD room model (Jacob's Q2 choice)** — defined in `lib/server/chat/constants.ts` `FIXED_CHANNELS`:
  `all-admins` (every admin) + two fixed-membership named channels "Anna, Greg & Jacob" and
  "Diego, Anna & Greg" + 1:1 DMs. (House had `all-admins` + a `leadership` room — LD does not.)
  Membership joins lazily on any chat-API hit (`ensure_my_chat_setup`) and eagerly at boot
  (`ensure_all_admins_in_team_chat`, wired in `hooks.server.ts`).
- The four byte-identical harness files house/LD warns about (db worker) are unrelated to chat;
  chat is its own server-authoritative layer.

## notify_channel + targeted pings
`users.notify_channel` ('email' | 'ntfy', migration `20260625c`) lets each admin choose where
TARGETED pings (message assignment + team chat) land. `notify_admin` (in `notify-admins.ts`,
upgraded to house's version) reads it server-side. The column **rides to admin clients via the
existing download-only directory sync** (`VALID_COLUMNS` is auto-derived from the drizzle schema,
so no sync-config change was needed) and is flipped via `/api/admin/set-notify-channel`. The
broadcast `notify_admins` (new-inbound) stays ntfy-only.

## Message triage (matching, not AI)
`/admin/messages/unmatched` + `/api/admin/match-thread-to-user` (ports of house) let an admin
point a `from_user_id IS NULL` thread at the right user — stamps `from_user_id`, backfills NULL
customer messages, and inserts an `email_aliases` row (`source='inbound-match'`) so future mail
auto-resolves. The **AI triage pipeline** (LLM classification of inbound) is deliberately NOT
ported — it's planned separately in `.issues/ai-triage-pipeline.md` (needs LLM provider/key +
LD routing decisions).

## Shared-infra additions made during the port
- `ResponseCodes.PAYLOAD_TOO_LARGE = 413` (`lib/constants.ts`).
- `log_errors?: boolean` option on `post_request`/`get_request` (`lib/utils/requests.ts`) — set
  `false` on background polls so a transient redeploy network blip doesn't spam the console.
- Ported pure utils from house: `lib/utils/text-to-html.ts`, `lib/utils/linkify-html.ts`,
  `lib/r2/get-attachment.ts`.
