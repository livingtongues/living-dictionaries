# AI inbound-message triage pipeline (port from house) — BUILT (awaiting key + review)

## ✅ DONE (2026-06-25)
- **Migration** `20260625e_triage.sql`: 7 `triage_*` cols on `message_threads` + seeded agent
  system user (`5a12e3e0-03eb-489f-a23b-23cc3d2a1c12`, `agent@livingdictionaries.app`). Verified all
  6 shared-migrations apply in order on a fresh DB; cols + seed present. Cols also added to the
  drizzle `shared.ts` (VALID_COLUMNS auto-derived → rides to admin clients via existing sync).
- **`$lib/agent/triage/*`**: constants, types, build-context (LD dictionaries/roles/prior-threads —
  NO Stripe), resolve-url (LD route grammar), build-prompt + examples (LD domain), classify (xAI
  grok-4.3, env-gated), routing (single-admin), apply-triage, run-triage (IS_STANDBY + is_internal
  guard).
- **`$lib/agent/auto-resolve/*`**: notification-registry (mailer-daemon/postmaster bounces) +
  resolve-notification.
- **`is_internal_email`** added to `$lib/admins.ts` (+ tests).
- **Wired** `fire_agent_email_inbound` + notification auto-resolve + internal-skip into
  `/api/messages/email-inbound`; also fired triage from `/api/messages/contact` (LD's primary
  inbound channel).
- **UI**: `RoutingLegend.svelte` (full + compact), `triage-panel.svelte` + stories, wired into the
  thread page (panel + `bind:body_html` on reply-composer for "Use draft"), `/admin/triage-examples`
  page (legend + examples) + nav link.
- **Tests**: routing/apply-triage/classify-normalize/notification-registry (inline) + resolve-url +
  pipeline.integration + classify.live (gated). Full suite: 616 pass / 3 skip. `pnpm check` 0 errors.
  `eslint` 0 errors. svelte-look screenshots verified for all panel flavors + examples page.

## ⏳ REMAINING (needs Jacob)
1. **Add `XAI_API_KEY`** to `vps-setup/secrets-decrypted/sveltekit-living.env` + push via
   `bin/sync living` (or equivalent). Pipeline is INERT until this is set (run_triage logs + returns).
2. Optionally run the live test where the key lives:
   `XAI_API_KEY=sk-... pnpm vitest run src/lib/agent/triage/classify.live.test.ts`.
3. Review prompt/examples wording + routing once real inbound arrives; tune `notification-registry`
   if other machine senders show up.

---

# AI inbound-message triage pipeline (port from house) — IN PROGRESS

## Codebase findings (2026-06-25 research pass)
- **Wiring point**: `/api/messages/email-inbound/+server.ts` already does threading + insert +
  broadcast `notify_admins`. Add a fire-and-forget `fire_agent_email_inbound({ thread_id, ... })`
  AFTER the txn + attachments, BEFORE the `json()` return (it has `thread_id`/`is_new`).
- **message_threads** already has `assigned_to_user_id` / `assigned_at` / `assigned_by_user_id` +
  `resolved_*` + `to_email` columns → apply-triage reuses them as-is. Only the 7 `triage_*` columns
  are new. `author_kind` enum on `messages` already includes `'agent'`.
- **Migration mechanics**: `run_sql_migrations` runs the SAME `shared-migrations/*.sql` glob on BOTH
  the server `shared.db` AND every admin wa-sqlite client (`db/server/shared-db.ts` +
  `db/client/db.ts`), sorted by filename. So a `20260625e_triage.sql` ALTER + seed runs everywhere.
  The seeded agent `users` row rides to clients via the download-only `users` sync.
- **Sync**: `message_threads` is in `SYNCABLE_TABLE_NAMES` → triage_* columns reach admin clients
  with NO sync-config change (VALID_COLUMNS auto-derived). Confirmed.
- **notify_admin** (targeted, honors notify_channel) is ported + live. **notify_admins** (broadcast)
  already fires on every inbound. apply-triage uses `notify_admin`.
- **Utils present**: `html-to-text.ts`, `text-to-html.ts`, `format-relative-time.ts`. ✅
- **MISSING in LD**: no `is_internal_email` helper (house has one in `$lib/admins`). Must add — skip
  triage for mail from `@livingdictionaries.app` + admin emails (e.g. our own OTP/no-reply loops).
- **NO Stripe / subscriptions table** → build-context replaces subscription facts with LD facts:
  sender's dictionaries + roles (join `dictionary_roles`→`dictionaries`), entry_counts, recent
  threads from same sender.
- **Reply composer**: LD's `reply-composer.svelte` keeps `body_html` as internal `$state`. To wire
  "Use draft", make it `$bindable` (house pattern: `body_html = $bindable('')`) and bind from the
  thread page `<TriagePanel onusedraft={(html) => draft_html = html} />` + `<ReplyComposer
  bind:body_html={draft_html} />`.
- **Standby guard**: house uses `env.IS_STANDBY`. Check if LD has blue/green standby concept; if not,
  drop that guard.
- **Provider key**: `XAI_API_KEY` already wired for house on its VPS; referenced in
  `vps-setup/bin/push-mustang-secrets.sh`. Need to add to `sveltekit-living.env`.

# AI inbound-message triage pipeline (port from house) — PLANNING

Standalone follow-up to `port-house-admin-features.md` (Q6: build the unmatched→match
flow now; the AI triage pipeline gets its own plan). This is a sizeable LLM feature that
needs a few LD-specific decisions before building — DO NOT start coding until those are
answered.

## What it is (house `site/src/lib/agent/`)
An LLM classifies each inbound customer email, writes `triage_*` columns on the thread,
auto-resolves obvious spam/notifications, auto-assigns the rest to the right admin, and
drafts a suggested reply + internal advice. A human reviews everything (the model has NO
tools — it only returns structured JSON the server applies). The `triage-panel.svelte`
in the thread page displays the verdict/category/confidence/summary/advice/draft.

## House file map (what to port)
- `triage/constants.ts` — model id (`grok-4.3`), categories/verdicts/confidence, AGENT_USER_ID/email/name.
- `triage/types.ts` — `TriageResult` shape.
- `triage/build-context.ts` — read-only server assembly of thread + user facts handed to the model.
  **House pulls Stripe subscription facts (SAFE fields only).** LD has no Stripe → replace with
  LD-relevant context: the sender's dictionaries + roles, recent threads, entry counts.
- `triage/build-prompt.ts` — system prompt (HVSB-specific) + few-shot examples. **Rewrite for LD's
  domain** (language documentation, dictionary editing, contributor access, linguistics).
- `triage/examples.ts` — curated few-shot exemplars. **Rewrite for LD.**
- `triage/classify.ts` — stateless toolless xAI call (`response_format: json_schema`). Injectable.
- `triage/routing.ts` — category → admin. **Rewrite for LD's 4 admins** (see decisions).
- `triage/apply-triage.ts` — applies the verdict: spam/notification → auto-resolve; else assign +
  `notify_admin` (uses the notify_channel infra we just ported ✅). PUBLIC_BASE_URL → LD.
- `triage/resolve-url.ts` — maps a thread's referenced URL to page context.
- `triage/run-triage.ts` — orchestration entry.
- `auto-resolve/*` — notification auto-resolver (e.g. delivery receipts).
- `email-inbound-hook.ts` — wires triage into the inbound endpoint. **Wire into LD's
  `/api/messages/email-inbound`** (fire-and-forget, never block inbound).
- `routes/admin/messages/[thread_id]/triage-panel.svelte` — display panel (port ~verbatim; theme vars).
- `routes/admin/triage-examples/*` — admin page to eyeball/tune exemplars (optional).

## DB migration needed (new `20260625e_triage.sql` or later)
Add to `message_threads`: `triage_verdict`, `triage_category`, `triage_confidence`,
`triage_summary`, `triage_advice`, `triage_draft_reply`, `triage_at` (all nullable TEXT).
Seed a singleton **agent system user** (fixed UUID) so agent-authored draft messages have an
author. These columns are on a syncable table → they ride to admin clients automatically (the
triage-panel reads them via the live row). Confirm no sync-config change needed.

## LD adaptations / DECISIONS (LOCKED 2026-06-25)
1. **LLM provider + key.** ✅ Reuse xAI Grok `grok-4.3` via `XAI_API_KEY`. Add key to
   `vps-setup/secrets-decrypted/sveltekit-living.env`. Whole pipeline env-gated → inert until set.
2. **Categories** (model labels; verdict stays `spam`|`human`; `notification` is an auto-resolve
   marker the model never emits): ✅ `technical`, `content`, `account`, `partnership`, `other`.
3. **Routing (category → single admin)** — NO multi-assign (Jacob dropped it; just ping Diego for
   the would-be-multi ones). Single-admin model = byte-compatible with house's routing.ts:
   - technical → **Jacob** (`jwrunner7@gmail.com`)
   - content → **Diego** (`diego@livingtongues.org`)
   - account → **Anna** (`dictionaries@livingtongues.org`)
   - partnership → **Diego** (`diego@livingtongues.org`)
   - other → **Jacob**
   - fallback (low-confidence + spam alert) → **Jacob**
4. **Drafts** ✅ all human categories get a customer-facing draft EXCEPT `partnership`
   (relationship-sensitive → advice-only). `normalize_result` withholds draft for spam + partnership.
5. **Auto-resolve** ✅ spam (verdict) auto-resolves; port notification-registry framework seeded
   minimally (mailer-daemon / postmaster bounce notices); `is_internal_email` skips our own
   `@livingdictionaries.app` OTP/no-reply loops (add helper to `$lib/admins.ts`).
6. **Routing legend** ✅ small reusable `RoutingLegend` (reads `CATEGORY_ROUTING`) on the ported
   `/admin/triage-examples` page + a compact legend in the thread triage panel.
7. **Base URL** for admin deep-links: `https://new.livingdictionaries.app` (matches chat-notify).
8. **Standby**: keep house's `env.IS_STANDBY` guard verbatim (LD uses blue-green too).

### Old open decisions (superseded by the above)
4. **Draft replies.** Which categories get a customer-facing draft vs advice-only?
5. **Auto-resolve scope.** Confirm spam + automated-notification auto-resolve is wanted.
6. **Cost/volume.** LD inbound volume is low; per-message LLM cost likely negligible.

## Verification
- Unit: `apply-triage` (spam→resolved, assign+notify) with `NTFY_DISABLED=1`; `resolve-url`;
  prompt/context builders. `classify.live.test.ts` gated on the API key (no spend in CI).
- Integration: pipeline test on an in-memory DB (house has one to mirror).
- Manual: send a test inbound, confirm the panel renders + the right admin is pinged.

## Dependencies already in place (from the admin-features port)
✅ `notify_admin` honors notify_channel · ✅ message assignment (`/api/messages/assign`,
`assigned_*` columns) · ✅ unmatched→match flow · ✅ `html_to_text` / `text_to_html`.
