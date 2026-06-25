# Port house admin-backend features into Living Dictionaries

Bring four house `/admin` improvements over to LD. Order matters a bit (notify
infra underpins chat + triage pings).

## STATUS: ✅ DONE (2026-06-25) — pending Jacob's review (not committed)
Verified: `pnpm test` 586 pass · `pnpm check` 0 errors · `pnpm lint` clean · svelte-look
screenshots of schema-graph, dashboard, chat composer + message-item (all flavors).
- ✅ 1. Schema graph — new hand-rolled canvas engine + `graph-geometry.ts`, dropped Cards
  view + `@xyflow/svelte` dep, focus-in-URL (`?table=`), kept LD's 4 source tabs.
- ✅ 2. notify_channel — migration `20260625c`, drizzle column, upgraded `notify-admins.ts`,
  `/api/admin/set-notify-channel` (+test). Auto-whitelisted in sync (VALID_COLUMNS).
- ✅ 3. Team chat — migration `20260625d` (server-only tables), `lib/server/chat/*` +
  `lib/admin/chat/*` + 10 `/api/admin/chat/*` endpoints + reping cron + boot wiring + nav
  badge + Team page. Rooms per Q2. `text-to-html` + `linkify-html` + `r2/get-attachment` ported.
- ✅ 4. Dashboard — `/admin/+page.svelte` card grid + ntfy onboarding + NotifyChannelToggle
  (replaced the 307 redirect). Added Team to nav.
- ✅ 5. Triage — `/admin/messages/unmatched` + `/api/admin/match-thread-to-user` (+test) + inbox link.
- ⏸️ 6. AI triage pipeline — planned separately in `.issues/ai-triage-pipeline.md` (needs Jacob
  decisions: LLM provider/key, categories, routing). NOT built.

Small shared-infra additions made along the way: `ResponseCodes.PAYLOAD_TOO_LARGE`,
`log_errors` option on `post_request`/`get_request`.

## LOCKED DECISIONS (2026-06-25)
- **Q1 Schema:** graph-only — DROP the Cards view; new hand-rolled engine + focus-in-URL.
  Keep LD's real source tabs (they map to genuinely distinct schemas: server-shared /
  local-admin / dictionary / paste — more than house's 3 because LD has per-dict DBs).
- **Q2 Chat rooms:** "All Admins" (all 4) + 1:1 DMs + two FIXED-membership channels:
  - "Anna, Greg & Jacob" → dictionaries@livingtongues.org, livingtongues@gmail.com, jwrunner7@gmail.com
  - "Diego, Anna & Greg" → diego@livingtongues.org, dictionaries@livingtongues.org, livingtongues@gmail.com
  - No "Leadership" room.
- **Q3 Seed:** none — chat starts empty (skip chat-seed module + hook).
- **Q4 Attachments:** yes (reuse LD put-attachment + attachments bucket).
- **Q5 notify_channel:** yes — column + set-notify-channel endpoint + upgrade notify-admins.
- **Q6 Triage:** build the unmatched→match-to-user flow now; ALSO port/plan the AI triage
  pipeline (separate big effort — write its own thorough plan issue; build if self-contained
  + env-gated behind an LLM key so it's inert until configured).
- **Q7 Delivery:** one continuous pass, no mid-review. Go far, go fast. Don't commit until told.

Source repo: `~/code/house`. Target: `~/code/living-dictionaries`.

**Explicitly OUT of scope (user said the `/data` browser "doesn't work very
well"):** the `/admin/data` row browser/editor. Skip it.

---

## 1. Schema-graph rewrite (drop `@xyflow/svelte`)

LD's schema Graph view (ported 2026-06-05) still runs `@xyflow/svelte` + dagre.
House rewrote it 2026-06-10 as a hand-rolled CSS-transform pan/zoom canvas + SVG
edges, with pure unit-tested geometry, dropping the ~150KB xyflow dep.

Port from `house/site/src/routes/admin/schema/`:
- `graph/graph-geometry.ts` — NEW pure module (zoom-to-cursor, fit-view, bezier
  edge paths, delete-glyph hit-test) + its inline vitest.
- `graph/schema-graph.svelte` — replaces LD's xyflow version (541 vs 355 lines).
- `graph/table-node.svelte`, `graph/graph-toolbar.svelte` — adapt.
- `graph/build-graph.ts` — house version (has `build_focused_graph`).
- `+page.svelte` — focus-in-URL (`?table=`) so browser-back exits a focus.

LD-specific reconciliation:
- LD has **4 source tabs** (shared / dictionary / admin / paste) vs house's 3
  (server / local / paste). Keep LD's 4.
- LD's schema page also has a **Cards view** (`schema-cards.svelte` /
  `table-card.svelte`) house lacks. Decision: KEEP Cards; only swap the Graph
  engine. LD's graph currently calls `on_node_jump` (jump to Cards); house uses
  focus-in-URL. Reconcile: node-click = focus (house), keep a separate affordance
  to jump to Cards if cheap.
- Remove `@xyflow/svelte` from `site/package.json` (KEEP `dagre` — layout still
  uses it). Verify nothing else imports xyflow.
- Port/refresh stories: `schema-graph.stories.ts`, add `table-node.stories.ts`.

Verify: `pnpm check`, vitest for graph-geometry, svelte-look screenshots of
schema-graph stories, confirm xyflow gone from the bundle.

---

## 2. Notify-channel preference (prereq for chat + triage email fallback)

LD's `notify-admins.ts` is the OLD version — `notify_admin` is ntfy-only. House's
honors a per-admin `users.notify_channel` ('email' | 'ntfy') with a rich email
fallback.

- Migration: `ALTER TABLE users ADD COLUMN notify_channel TEXT NOT NULL DEFAULT 'email'`.
  `users` rides down via LD's download-only directory sync → no sync-config change.
- Upgrade `lib/notifications/notify-admins.ts` to house's version (`resolve_channel`,
  `send_ping_email`, `EmailPingExtras`). LD already has `send_email`; confirm
  `no_reply_address` / `$lib/email/addresses` exist.
- New endpoint `/api/admin/set-notify-channel` (+ `_call.ts`, server.test).

---

## 3. Team chat (admin-to-admin)

Self-contained, server-authoritative (NOT a sync sector). Port from house:

Schema (server-only tables, created-but-empty on clients, excluded from
`SYNCABLE_TABLE_NAMES`): `chat_rooms`, `chat_room_members` (+ `gentle_reping_at`),
`chat_messages`, `chat_attachments`, `admin_presence`. One LD migration file.

Server (`lib/server/chat/`): `chat-db.ts`, `chat-notify.ts`, `constants.ts`,
`api.ts` (gate_chat/throw_chat_error), `ensure-team-membership.ts`,
`notification-email.ts`. Plus `lib/db/server/chat-reping-cron.ts` (wire into
`hooks.server.ts`, IS_STANDBY-gated like the snapshot cron) and optionally
`chat-seed.ts`.

Client (`lib/admin/chat/`): `rooms.ts`, `attachments.ts`, `chat-store.svelte.ts`,
`chat-composer.svelte`, `chat-message-item.svelte`. Plus `routes/admin/team/+page.svelte`.

API (`routes/api/admin/chat/*` + `_call.ts`): rooms, messages, send, edit, delete,
dm, read, heartbeat, upload (R2 via LD's `put-attachment`), attachments/[id].
5s poll + heartbeat presence.

Needs: `lib/utils/text-to-html.ts` (LD missing it; has `html-to-text`).

LD adaptation: rooms = "All Admins" (+ 1:1 DMs). DROP house's "Leadership" room
(only 4 LD admins). Membership via `ensure_my_chat_setup` (all-admins for every
admin). Re-ping email/ntfy honored via notify_channel (item 2).

---

## 4. Admin dashboard + ntfy setup (`/admin/+page.svelte`)

LD's `/admin/+page.ts` just `redirect(307 → /admin/messages)`. House has a
card-grid landing page + phone-notification (ntfy) onboarding + the notify_channel
toggle.

- Replace redirect with `+page.svelte` card grid. LD cards: Messages, Users,
  Dictionaries, Analytics, Schema, Sync, Team.
- ntfy section: shows the signed-in admin's private `ntfy_topic` + iOS/Android/
  desktop subscribe steps + the Email/Phone-push toggle (calls set-notify-channel).
- Add `Team` (and `Analytics`) to `routes/admin/+layout.svelte` nav.

---

## 5. Message triage — unmatched → match-to-user

LD already has `message_threads.from_user_id` (nullable), `assigned_*` columns,
`AssigneeDropdown`, and `/api/messages/assign`. Missing: the unmatched-threads
workflow.

- Port `routes/admin/messages/unmatched/+page.svelte` (lists `from_user_id IS NULL`
  threads; fuzzy-match candidate users — LD has `fuzzy-score`).
- Port `/api/admin/match-thread-to-user` (+ `_call.ts`, server.test).
- Link to unmatched from the inbox.

**NOT porting** house's AI-triage pipeline (`lib/agent/triage/*` + the
`triage-panel.svelte` that displays `triage_*` columns). That's house's LLM
classifier — a separate large feature; LD's schema has no `triage_*` columns.

---

## Verification
`pnpm test`, `tsc`, `pnpm lint`, `pnpm check`; svelte-look stories for schema-graph,
team chat (composer/message-item), dashboard, unmatched. Manual: chat send/poll,
ntfy push (or NTFY_DISABLED in dev), match a thread.

## Cross-repo sync note
Schema-graph + chat harness files are near-identical across house/LD; keep diffs
minimal so future patches port cleanly.
