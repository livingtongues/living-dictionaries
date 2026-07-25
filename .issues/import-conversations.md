# Import conversations — a durable manager↔team hub on the dictionary

Replaces the scattered pieces (Import page, admin inbox thread, emailed report
attachment, questions buried in prose) with ONE place per import request where
managers and the team talk, the resources are frozen as permanent history, the
report lives, and the questions get answered.

Blocks the tail of `.issues/eastern-pomo-import.md` (nothing has been emailed to
the requester — do not send until this ships).

## Why

Findings from the audit that motivated the whole thing:

1. **The conversation already exists and nobody can see it.** `request-import`
   creates a `message_threads` row + a `messages` row, and every later manager
   edit appends another `customer` message and reopens the thread. Managers have
   no read path — `message_threads`/`messages` only sync to admin clients.
2. **Nothing is frozen.** `require_requested_file_owner` lets the uploader
   `DELETE` a requested file + its R2 bytes at any point, including mid-import.
3. **The record evaporates on resolve.** `active_import_files` drops any
   source-linked file whose request thread is resolved — instructions, note, and
   history vanish from the manager's view.
4. **Chat is the wrong substrate** even though it has the right mechanics: its
   gate is "member of ≥1 room ⇒ full chat member, and any chat member can DM any
   other". Dictionary managers must never land in that circle.
5. **The admin notification stack Jacob described already exists**:
   `post_system_notification()` → `notifications` room (no immediate ping) →
   `notification-digest-cron.ts` at 8am Pacific → `summarize_notifications()`
   rolls unread notices into "5 new users and 2 new dictionaries". Adding import
   activity is ONE new formatter + marker phrase.

## Decisions (Jacob, 2026-07-25)

- ✅ **Substrate: extend `message_threads`.** Same table, new server-authoritative
  manager window. Not chat, not a third system.
- ✅ **Import stays the front door.** `/{dict}/import` keeps the drop zone and
  gains a "Past imports" list; each request opens `/{dict}/import/{thread_id}`.
- ✅ **No internal notes at all.** Everything written in a conversation is visible
  to both sides. Team-internal chatter goes in team chat. The generated kickoff
  brief therefore must NOT be stored as a message (see "Kickoff brief" below).
- ✅ **These conversations leave `/admin/messages` entirely.** New `/admin/imports`
  index (open conversations, assignee, last activity, unanswered-question count)
  + a count on the admin dashboard.
- ✅ **Audience:** every current manager of the dictionary can read + post. Email
  goes only to *participants* (requester + anyone who has posted).
- ✅ **Freeze on `started_at`** (stamped at Phase 0). Before it, the manager can
  "Withdraw request" which unlocks edit + delete. After it: read-only for them,
  forever. We can still delete via an agent.
- ✅ **Notifications:** assignee gets an immediate direct ping; every other admin
  sees a System notice in the `notifications` room, rolled into the 8am digest.
  **One notice per conversation per unread batch** — no notice while an unread
  one is already sitting there.
- ✅ **Managers get a short chat-style email** — one line of what was said + an
  "Open the conversation" button. Email/ntfy are doorbells, never mailboxes.
- ✅ **Stray email replies auto-ingest** into the conversation via References
  matching (nearly free — see below).
- ✅ **Questions are structured rows** supporting free text AND radio/multi
  choice; answers mirror into the timeline as messages.
- ✅ **Report is stored HTML**, rendered in a sandboxed iframe on the page with a
  download link (supersedes `.issues/future/import-report-artifact.md`).
- ✅ **Resolve stays a dumb manual button** — no state machine, no auto-reopen
  magic. New activity always posts a Notifications-room notice, so nothing is
  lost even on a resolved conversation.
- ✅ **Build it all, then** send Eastern Pomo a two-sentence note linking to their
  conversation.

## Decisions taken by the agent (small, flagged for Jacob)

- **Kickoff brief becomes a derived view, not a stored message.** `Q1=B` forbids
  internal messages, but Jacob still needs the agent-ready runbook. So
  `build_import_request_body()` stops being written into `messages` at request
  time and instead renders on demand behind a "Copy job brief" button. The
  conversation's first message becomes the manager's own `request_note`
  (natural), with the resources as a block.
  - **The button lives in BOTH places, admin-only** (Jacob, 2026-07-25): on the
    `/{dict}/import/{thread_id}` conversation header (where the notification link
    lands him) and on each `/admin/imports` row. One shared component + one
    admin-gated `GET …/conversations/{tid}/brief`. It is a UI affordance, not a
    message, so the no-internal-notes rule is untouched.
- **One transport, not two.** Both managers and admins read/write the
  conversation through `/api/v1/dictionaries/{id}/conversations/*`
  (`verify_dict_api_access` already admin-bypasses). Only the cross-dictionary
  `/admin/imports` index is local-first, since `message_threads` already syncs to
  admin clients — so that index needs no new endpoint at all.
- **Notification dedupe is deterministic**, not fuzzy: an `activity_batch`
  integer on the thread, incremented when an admin opens the conversation. The
  Notifications-room post uses `client_message_id =
  'import-activity:{thread_id}:{batch}'`, and `chat_messages` already has a
  UNIQUE index on `(room_id, author_user_id, client_message_id)` — so a repeat
  post inside the same batch is a no-op at the DB level.

## Architecture

```
manager (session)  ─┐
agent (API key)    ─┼─→ /api/v1/dictionaries/{id}/conversations/*  ─→ shared.db
admin (session)    ─┘        (verify_dict_api_access)                 message_threads
                                                                      messages
                                                                      thread_participants
                                                                      thread_questions
                                                                      thread_artifacts
                                                                      source_files

/admin/imports (index only)  ─→ local-first synced message_threads
notifications                ─→ post_system_notification() + 8am digest
manager email                ─→ notify_user() + send_raw_email w/ Message-ID
inbound reply                ─→ find_or_create_thread() References match (already works)
```

### Why auto-ingest of stray replies is nearly free

The manager notification email is sent with an RFC `Message-ID` recorded on the
team's `messages` row (exactly what `routes/api/messages/reply/+server.ts` already
does). `find_or_create_thread()` matches inbound `References`/`In-Reply-To`
against `messages.message_id` and returns the existing thread — so the reply
appends a `customer` message to the conversation and renders on the page with no
new matching code. Only requirement: stamp `message_id` on the outbound row.

## Schema (new migration `20260725_import_conversations.sql`)

```sql
ALTER TABLE message_threads ADD COLUMN thread_kind TEXT;          -- 'import' | NULL (legacy/support)
ALTER TABLE message_threads ADD COLUMN started_at TEXT;           -- team began work → resources frozen
ALTER TABLE message_threads ADD COLUMN started_by_user_id TEXT;
ALTER TABLE message_threads ADD COLUMN activity_batch INTEGER;    -- notification dedupe counter

CREATE TABLE thread_participants (      -- server-only, never syncs
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  side TEXT NOT NULL,                   -- 'manager' | 'team'
  last_read_at TEXT,
  last_notified_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE thread_artifacts (         -- server-only; bytes in private R2
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  dictionary_id TEXT NOT NULL,
  kind TEXT NOT NULL,                   -- 'preview' | 'report'
  title TEXT,
  storage_key TEXT NOT NULL,
  mimetype TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  import_id TEXT,
  source_id TEXT,
  stats_json TEXT,                      -- {entries, senses, review_flags, ...}
  created_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE thread_questions (         -- server-only
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  dictionary_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,                   -- 'text' | 'choice' | 'multi_choice'
  title TEXT NOT NULL,
  body_html TEXT,                       -- short context; long form lives in the report
  options_json TEXT,                    -- [{value,label}] for choice kinds
  report_anchor TEXT,                   -- deep-link into the artifact
  answer_text TEXT,
  answer_values_json TEXT,
  answered_by_user_id TEXT,
  answered_at TEXT,
  status TEXT NOT NULL,                 -- 'open' | 'answered' | 'closed'
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Backfill in the same migration**: `thread_kind='import'` +
`started_at = COALESCE(replied_at, resolved_at, created_at)` for every thread
with a `source_files.import_thread_id` pointing at it (Enxet + Eastern Pomo).
Seed `thread_participants` from `from_user_id` + `assigned_to_user_id`.

Neither new table goes in `SYNCABLE_TABLE_NAMES`.

## Endpoints (`/api/v1/dictionaries/{id}/conversations/*`)

Human/agent parity — the manager UI and an outside agent finishing an import use
the identical routes, wrapped in `_call.ts` per the project convention.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/conversations` | manager, admin, key | list + unread + open-question counts |
| GET | `/conversations/{tid}` | " | messages, files, artifacts, questions |
| POST | `/conversations/{tid}/messages` | " | posts; fires notifications |
| POST | `/conversations/{tid}/read` | " | stamps `last_read_at`; admin bumps `activity_batch` |
| POST | `/conversations/{tid}/start` | admin, key | stamps `started_at` → freeze |
| POST | `/conversations/{tid}/withdraw` | manager | only while `started_at IS NULL` |
| POST | `/conversations/{tid}/artifacts` | admin, key | uploads report/preview HTML to R2 |
| GET | `/conversations/{tid}/artifacts/{aid}` | all | serves bytes (iframe + download) |
| POST | `/conversations/{tid}/questions` | admin, key | bulk create |
| PATCH | `/conversations/{tid}/questions/{qid}` | manager answers / agent edits | mirrors answer into timeline |
| POST | `/conversations/{tid}/resolve` | admin, key | plain toggle |

## UI

### `/{dict}/import` (manager, existing page)
- Drop zone + pending files + request button — unchanged.
- Requested/active requests become compact cards linking into the conversation.
- New **"Past imports"** section: every conversation, newest first, with date,
  entry count (from `thread_artifacts.stats_json`), unanswered-question badge.
  Replaces `active_import_files`' disappearing act — nothing is ever dropped.

### `/{dict}/import/{thread_id}` (manager + admin, the hub)
Timeline of blocks in one scroll:
- **Resource block** — who uploaded what, their instructions, source note; a
  frozen banner once `started_at` is set.
- **Messages** — avatar, name, timestamp; `customer` vs `admin`/`agent` styling.
- **Artifact block** — report title + stats, sandboxed iframe preview
  (`html-body-iframe.svelte` moved to `$lib/components/ui/`), open-full +
  download.
- **Question set** — free-text boxes and radio/multi choices, "N of M answered",
  each with a "full context in the report ↗" anchor link.
- **Composer** — message + file drop (a new upload while the conversation is open
  attaches to the same thread).

### `/admin/imports` (new, local-first)
Table of open conversations across all dictionaries: dictionary, requester,
assignee, last activity, unanswered questions, `started_at` state. Nav entry
next to Messages; count on the dashboard. **"Copy job brief"** button per row
(the derived kickoff runbook).

### `/admin/messages`
Filter `thread_kind = 'import'` out of the inbox, resolved, and unmatched lists.
Triage never touches them (it only runs on inbound email classification).

## Notifications

- **Manager**: `notify_user()` with chat-style content (one line + "Open the
  conversation" button), sent with a recorded RFC `Message-ID`. Policy mirrors
  chat: skip if already notified since their `last_read_at` (one ping per unread
  batch). `Reply-To` = the normal support address; body carries a "please answer
  on the site so it's saved with your dictionary" line, and a stray reply
  auto-ingests anyway.
- **Assignee**: immediate `notify_admin()` (honors ntfy/email choice).
- **All other admins**: `post_system_notification()` with a new
  `format_import_activity_notification()` + marker phrase, deduped by
  `client_message_id`. Add the marker to `summarize_notifications()` so the 8am
  digest reads "…and 1 import conversation with new activity". The existing
  vitest marker-drift assertions must cover the new formatter.

## Freeze rules

- `started_at IS NULL` → uploader may edit instructions/source note, delete the
  file, and "Withdraw request" (unsets `import_requested_at`, deletes the thread).
- `started_at` set → `require_requested_file_owner` additionally rejects mutation
  and deletion for everyone except a site admin. Manager UI hides the controls
  and shows the lock banner.
- Resolve does **not** affect freeze or visibility.

## Docs to update

- `site/src/lib/api/v1/guides/importing.md` — §2.7 becomes "post the report as an
  artifact + file your questions", replacing the email-attachment instruction;
  Phase 0 gains the `start` call; runbook step 11 rewritten.
- `openapi.json` / `openapi.ts` — the new conversation endpoints.
- `.knowledge/domain/import-workflow.md` — drop the `triage_draft_reply` +
  `message_attachments` parking trick entirely (obsolete); replace with the
  conversation hand-back.
- `AGENTS.md` — the `/[dictionaryId]/import` route description + `/admin/imports`.
- `.issues/future/import-report-artifact.md` — delete, superseded by this.
- EN locale files only for new i18n keys.

## Build log (2026-07-25) — code complete

- ✅ Migration `20260725_import_conversations.sql` + drizzle schema, incl. the
  Enxet/Achi/Eastern-Pomo backfill. `messages.author_kind` gained `'system'`
  (no CHECK constraint existed) for machine-generated event lines.
- ✅ `$lib/db/server/import-conversations.ts` (data layer, 9 unit tests) +
  `import-conversation-notify.ts` (fan-out policy) +
  `$lib/import/server/conversation-access.ts` (route guards).
- ✅ 9 endpoints under `…/conversations/*` + `_call.ts`; `patch_request` added to
  `$lib/utils/requests.ts` (the two hand-rolled PATCH fetches in the files
  `_call` now use it). 24 endpoint tests.
- ✅ Freeze wired into `PATCH/DELETE …/files/{id}` and the request-note PATCH.
  Withdraw endpoint for the pre-start escape hatch.
- ✅ `/admin/imports` + `/api/admin/imports`; import threads filtered out of the
  inbox / resolved / unmatched lists; dashboard + nav entries.
- ✅ Manager UI: `/{dict}/import` "Past imports" (nothing ever disappears now),
  `/{dict}/import/{id}` conversation page, 6 new components + stories.
- ✅ Notifications: `format_import_conversation_notification` + marker +
  `summarize_notifications` category with a drift guard.
- ✅ Docs: guide runbook + new §0.2 + rewritten §2.7, kickoff-brief runbook,
  openapi (`conversations` tag, 9 paths), knowledge page, AGENTS.md.
  `.issues/future/import-report-artifact.md` deleted (superseded).

### Two defects caught in visual review (fixed)

1. **The report iframe only ever grew.** `documentElement.scrollHeight` is
   floored at the iframe's own viewport height, so feeding it back as the height
   made the frame monotonically expand and never shrink to its content — a short
   report rendered with ~250px of blank space. Now measures `body.scrollHeight`
   plus body margins only.
2. **Machine events rendered as the manager's own chat bubble** — "You: Import
   resource metadata updated by Dev Manager <dev-manager@example.com>." Those
   follow-ups are now `author_kind = 'system'`, written in plain voice
   ("Dev Manager updated the details for x.csv"), and rendered as a quiet
   centered event line.

## Verification

- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check` all clean.
- Unit tests: freeze guard, participant notify policy, `activity_batch` dedupe,
  digest marker for the new formatter, withdraw guard, question answer mirroring.
- svelte-look stories for every new component, light/dark, desktop/mobile.
- Puppeteer end-to-end in dev per the `dev-auth` skill: manager uploads →
  requests → admin starts (freeze verified: delete now 403) → admin posts report
  artifact + questions → manager answers → notification rows asserted in
  `.data/shared.db`.

## Then: finish Eastern Pomo — BLOCKED ON DEPLOY

The report work is done; the production steps cannot run until this ships,
because the migration has to create the tables on the VPS first.

- ✅ `report.html` regenerated with the de-dup pass. `report.py` now carries an
  `explained_above` registry (questions declare `covers=[…]`), so an entry a
  general question already explains gets a one-line pointer in the per-entry list
  instead of a second write-up; `fresh_example()` makes the rules section reach
  for cases nobody has seen yet (the brackets rule no longer re-uses
  `phuubEmduule`, the merge rule no longer re-uses row 1042); the review-queue
  index is now word + what-we-need + a jump link, with no repeated prose.
- ✅ The future sentence-splitting offer is gone from question 6 — it now just
  asks whether they came from recorded stories. Jacob will raise the rest later.
- ✅ **Reports must survive with JavaScript disabled** (the artifact CSP grants no
  `script-src`). `artifact.py`'s expand/collapse toolbar is now progressive
  enhancement — hidden by CSS, revealed by the script — and every section that
  anchors point into is `open` by default. Verified by serving the real 79 KB
  report through the dev artifact endpoint: `#q3` lands on question 3 with no JS.
- ⏳ **Needs deploy first**, then: `PATCH …/conversations/{tid}` is unnecessary
  (the migration backfills `started_at`), `POST …/artifacts` with `report.html`,
  `POST …/questions` with the 6 (raised-dot as a `choice`: boundary / long vowel /
  both / not sure), clear the stale `triage_draft_reply`, and post the short
  closing message. The exact question payload is in `/tmp/upload-real-report.mjs`
  on mustang — regenerate it rather than trusting that path to survive.
- ⏳ Requires a fresh per-dict API key (the old one was revoked 2026-07-25).
- ⛔ **Nothing goes to the requester without Jacob's explicit go-ahead.**
