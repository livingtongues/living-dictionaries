# AI inbound-message triage pipeline (`$lib/agent/*`)

Ported from house 2026-06-25 (see `.issues/ai-triage-pipeline.md` for the build log + the locked
decisions). An LLM classifies each inbound customer email, writes `triage_*` columns on the thread,
auto-resolves obvious spam/notifications, auto-assigns the rest to one admin, and drafts a suggested
reply + internal advice. The model has **NO tools** — it returns structured JSON the server applies;
a human reviews everything (nothing is auto-sent).

This page records only what isn't obvious from the code.

## Cross-repo: keep in sync with house
`$lib/agent/triage/*` + `auto-resolve/*` mirror `~/code/house/site/src/lib/agent/*`. The
**mechanical** files are near-identical and should be patched in both repos together:
`classify.ts` (the xAI call + `normalize_result`), `apply-triage.ts` (decide_actions + the UPDATE),
`run-triage.ts`, `email-inbound-hook.ts`, `resolve-notification.ts`, `triage-panel.svelte`.

The **domain** files are deliberately LD-specific and do NOT track house: `constants.ts`
(categories/agent identity), `build-context.ts` (LD dictionaries/roles vs house's Stripe subs),
`build-prompt.ts`, `examples.ts`, `routing.ts`, `resolve-url.ts`.

## What diverges from house
- **No Stripe.** `build-context.ts` hands the model the sender's *dictionaries + roles* (join
  `dictionary_roles`→`dictionaries`, plus dictionaries they `created_by_user_id`) + entry counts +
  prior-thread count, instead of subscription facts.
- **Categories** (`technical`, `content`, `account`, `partnership`, `other`) and the verdict
  (`spam`|`human`) are model-emitted; `notification` is an auto-resolver-only marker the LLM never
  emits.
- **Routing is single-admin** (no junction table — Jacob rejected multi-assign): technical/account/other
  → Jacob, content/partnership → Diego, fallback (low-confidence + spam) → Jacob. `CATEGORY_ROUTING` in
  `routing.ts` is the single source of truth; `RoutingLegend.svelte` renders from it.
- **Off-duty admins** (`admins.ts` `Admin.notify === false`, e.g. Anna from 2026-06-27) keep admin +
  chat ACCESS but are excluded from broadcast `notify_admins`, chat gentle re-pings, and the triage
  routing map (account moved Anna→Jacob). They can still be assigned manually.
- **Draft withholding**: `normalize_result` nulls the draft for `spam` AND `partnership`
  (relationship-sensitive — an admin writes it personally). House withheld `theology` instead.
- **`notification-registry`** is seeded minimal (mailer-daemon/postmaster bounces) — LD has no
  Stripe receipts to suppress. Our own `@livingdictionaries.app` OTP/no-reply loops are skipped
  upstream by `is_internal_email` (`$lib/admins.ts`), before triage runs.

## Wiring + gating gotchas
- **Env gate**: the whole pipeline is inert until `XAI_API_KEY` is set (`run_triage` logs + returns).
  Add it to `vps-setup/secrets-decrypted/sveltekit-living.env`. Also `IS_STANDBY`-guarded so only the
  active blue/green container classifies.
- **Fired from TWO endpoints**: `/api/messages/email-inbound` (after insert; also runs the
  notification auto-resolve + gates the broadcast ntfy on `!notification && !is_internal_email`) AND
  `/api/messages/contact` (LD's primary inbound channel; `to_email: null`). Both fire-and-forget.
- **Agent system user** is seeded by `20260625e_triage.sql` so `assigned_by_user_id` /
  `resolved_by_user_id` = `AGENT_USER_ID` FKs resolve. The fixed UUID lives in BOTH the migration and
  `triage/constants.ts` — keep them identical.
- **Sync**: `triage_*` are on `message_threads` (already syncable) → they reach admin clients with no
  sync-config change. The migration's `ALTER`s aren't individually idempotent, but `run_sql_migrations`
  skips already-applied files via the `migrations` table (standard for every ALTER migration); the
  `INSERT OR IGNORE` seed is additionally re-run-safe.
- **"Use draft"**: `triage-panel.svelte` calls `onusedraft(text_to_html(draft))`; the thread page
  binds it into `reply-composer.svelte`'s `body_html` (made `$bindable`).
- **`/admin/triage-examples`** is a pure client page (imports `TRIAGE_EXAMPLES` directly — examples.ts
  is types-only/client-safe; the admin `+layout.ts` already gates `is_admin`). A `+page.server.ts`
  returning only `{ examples }` does NOT typecheck here because LD's root layout data is universal —
  the page-data type then demands the layout props.
