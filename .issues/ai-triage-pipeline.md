# AI inbound-message triage pipeline — LIVE (tuning backlog)

Built + committed (`42099efa`), env-gated on `XAI_API_KEY` (set). The full design, decisions, file
map, and routing rationale live in the code (`$lib/agent/triage/*`, `auto-resolve/*`,
`triage/routing.ts`) + the durable write-up at `.knowledge/admin/ai-triage-pipeline.md`.

## Remaining — organic tuning (no rush; watch via the daily log-review)
- Review the prompt / few-shot examples wording + category→admin routing once **real** inbound
  accumulates (the corpus so far is synthetic/e2e).
- Tune `auto-resolve/notification-registry` if new machine senders (beyond mailer-daemon/postmaster)
  show up.

## Current routing (for reference)
- technical / other / **account** → Jacob · content / partnership → Diego.
- **Anna is off-duty** (`admins.ts` `notify:false`) — she keeps admin + chat access but is no longer
  auto-assigned or pinged. (See `.issues/legal-live-and-anna-offboard.md`.)
