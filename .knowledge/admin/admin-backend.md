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
- **Chat-member rule (single source of truth: `is_chat_member_by_id` in chat-db.ts, mirrored in
  get-user.ts's `is_chat_member`) = admin (≥2) OR `users.chat_access` grant OR member of ≥1 room.**
  This is the `/chat` access gate (`gate_chat`), NOT an admin-level check. Page entry rides on
  `AuthUserData.is_chat_member` (SSR, no extra nav round-trip); endpoints re-check fresh.
  - **`chat_access`** is a boolean `users` column (2026-07-15, syncable/download-only), toggled per
    user on `/admin/users/[id]` ("Grant chat access", site-admin only, `/api/admin/users/[id]/chat-access`).
    It's the durable way to admit someone (e.g. a super manager) to chat WITHOUT first adding them to a
    channel. Jacob's design: "anyone admitted to chat can DM anyone" — see the one-circle rule below.
- **One circle**: any chat member can DM/see any other. `can_dm` = both parties are chat members
  (replaced the old `shares_room` "must share a channel" rule, 2026-07-15). `list_chat_directory`
  is caller-independent — it returns **every chat member** (self included, System excluded). Names
  resolve from `users.name` → email. (Partner-scoping was dropped; revisit only if external partners
  need isolating.)
- **All channels are DB rows** (FIXED_CHANNELS is gone — Jacob 2026-07-03: "cleaner in the long
  run"). Admins (≥2) create/rename/delete channels + add/remove members in the /chat UI;
  `chat_rooms.admin_room = 1` rooms are manageable **only by super admins (level 3)**.
  - **Membership is fully UI-managed** (2026-07-15) — the boot step no longer seeds admins into any
    room. `ensure_notifications_room` only upserts the one SYSTEM room (`notifications`); admins
    always pass the gate via their level, and are added to `notifications` explicitly if they want
    the feed. The old **`all-admins` room was removed entirely** (`ROOM_ALL_ADMINS` /
    `ensure_all_admins_in_team_chat` are gone); `notifications` can never be deleted and stays
    telemetry-only.
- **Non-admin members always get EMAIL pings** (`notify_chat_member`); allow-list admins keep their
  ntfy/email `notify_channel` pref. Same one-ping-per-unread-batch policy + 1-day gentle reping
  cron for everyone. Message `body_html` is **sanitized server-side with `xss`** at post/edit —
  required now that non-admins author messages rendered via `{@html}`.
- **The System bot** (`SYSTEM_USER_ID = 'system'`, a real `users` row) authors platform notices.
  Three deliberate behaviors (2026-07-14, Jacob):
  - **`post_message` bypasses `require_member` for System** — it posts into rooms it isn't a member
    of (notifications, and agent-authored DMs) WITHOUT joining, so a DM stays two-person. As of
    2026-07-15 System is **never** a room member (the notifications-membership insert was removed +
    `list_my_rooms.member_ids` filters it) so it never shows in a member list.
  - **It's excluded from read-receipt bubbles** (`get_room_read_positions` filters it) — posting
    marks the author "read", which otherwise parked a bogus System bubble on the latest message.
  - **The `notifications` room no longer pings per event.** `post_system_notification` only records
    the message (in-app badge); the per-event ping + 24h reping were replaced by ONE daily **8am
    Pacific digest** (`notification-digest-cron.ts`, day-guarded in `db_metadata`
    `notification_digest_last_day`) that summarizes each on-duty admin's unread events ("5 new users
    and 2 new dictionaries" via `summarize_notifications`). Regular DMs/channels still ping instantly;
    the reping cron explicitly excludes `notifications`.
- **Agent-authored System messages** (Jacob's agent posting as System into any room so recipients
  know it's the agent, not Jacob) go through the **`chat_system_outbox`** table: the agent raw-INSERTs
  one row (no API/auth — Jacob rejected that; `/system-chat` slash command documents it), and
  `system-outbox-cron.ts` (~20s) drains it — `post_message` as System + normal member ping (skipping
  `skip_user_id`, the human being acted for). Pings need the SvelteKit runtime for SES/ntfy, which is
  why a bare SQL insert can't ping and the outbox+cron exists. A past raw-insert attempt "didn't show"
  because `require_member` threw (System wasn't a DM member) — now bypassed.
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

## Admin telemetry split — usage vs health (2026-07-05, mirrors tutor/house)
`/admin/analytics` (**usage**) and `/admin/health` (**diagnostics**) are two pages that fetch the
**same** `/api/admin/analytics` endpoint (same `LogAnalytics`) via the same `$api/admin/analytics/_call`
— each just renders a subset of panels + cross-links to the other. Shared format helpers/palettes live
in `$lib/analytics/dashboard-format.ts`; the story fixture in `$lib/analytics/mock-analytics.ts`
(imported by both `_page.stories.ts`). When adding a panel, decide which page it belongs to; the
server computation stays one function (`get_log_analytics` in `lib/db/server/log-analytics.ts`).

### Telemetry storage + rollup-forward (2026-07-05, parity port of house)
Raw `client_logs` were split OUT of `shared.db` into a server-only **`logs.db`**
(`$lib/db/server/logs-db.ts`, code-created, boot-time `split_client_logs_from_shared` in
`hooks.server.ts`; aged rows → `logs-archive.db`). The forever rollups `log_daily_metrics` +
`log_daily_sessions` stay in `shared.db` so backups/dev-pulls keep dashboard history without the
raw-log bytes; **neither raw-log file is backed up** (the per-dict R2 snapshot builder never touches
either shared.db or logs.db, so no exclusion config is needed). `get_log_analytics` is a 3-tier
reader: shared.db rollups for days ≤ the `log_rollup_finalized_through` watermark, live `logs.db`
scans for the tail + the full-hot-window forensic panels (errors/perf/boot/i18n/api_v1/leader),
dev-fallback all-live when the cron never ran. 15-min in-memory cache keyed `days:audience`; the
`pipeline` liveness panel is always recomputed fresh. `session_id` is a **real column** (promoted
from `context.session_id` at ingest + backfilled) — the JSON-parse-per-row was the bulk of the old
multi-second freeze; the temp-set audience filter (`analytics_bot_uas` / `analytics_bot_sessions`)
replaced the per-row `is_bot_ua` UDF. Bot classification adds `bot-sessions.ts` (UA-frequency
crawlers: zero-heartbeat anon sessions sharing one plausible-human UA ≥20×/day) — LD prod confirmed
this pattern reclassifies ~28% of "sessions". Two pre-existing bugs were fixed in the port:
`rollup_day` now full-day-DELETEs before writing (ghost metrics), and `leader_health` groups on an
unshadowed `lq_source` alias (a bare `source` alias bound to the real `client_logs.source` COLUMN and
collapsed the admin/viewer/dict split). Full reference: house `.knowledge/architecture/client-logs.md`.

The **Synthetic uptime** panel (health page) is fed by `build_uptime` reading the `uptime_probe`
server-log family — rows POSTed by an **off-box prober on mustang** (configured in the `vps-setup`
repo, target `livingdictionaries.app`), NOT by anything in this repo. The ingestion path already
exists: `/api/log` treats a valid `X-Log-Source-Secret` (= `UPTIME_PROBE_SECRET`) as trusted
`source='server'`, and `uptime_probe` is in `log-analytics.ts`'s `INFRA_EVENTS`. Until the prober's
secret is provisioned in prod env the panel just reads "No synthetic probe data" — the code is inert,
not broken.
