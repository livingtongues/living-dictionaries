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

## LD adaptations / OPEN DECISIONS (need Jacob)
1. **LLM provider + key.** House uses xAI Grok (`grok-4.3`, `XAI_API_KEY`). Reuse xAI, or
   Anthropic/OpenAI? Where does the key live (vps-setup `sveltekit-living.env`)? Env-gate the
   whole pipeline so it's inert until the key is set.
2. **Categories.** LD has no billing/theology. Proposed: `technical`, `linguistic/content`,
   `account/access`, `partnership`, `spam`, `notification`. Confirm/edit.
3. **Routing (category → admin).** Map each category to one of LD's 4 admins
   (Jacob/Diego/Anna/Greg) + a fallback. Need Jacob's call on who handles what.
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
