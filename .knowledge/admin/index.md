# Admin backend

Knowledge for the local-first super-admin area (`/admin/*`).

- [admin-backend.md](./admin-backend.md) — the 2026-06-25 port of house's admin features
  (schema-graph rewrite, team chat, ntfy dashboard, message triage) + the cross-repo
  near-identical-file relationship with `house` that must be kept in sync.
- [ai-triage-pipeline.md](./ai-triage-pipeline.md) — the LLM inbound-email triage pipeline
  (`$lib/agent/*`): categories, routing, what diverges from house's version, and the env gate.
- [analytics-telemetry.md](./analytics-telemetry.md) — cross-repo `client_logs` analytics shapes:
  the three-signal bot classifier (frequency-bot two-signal gate), the `bot:` rollup namespace,
  and why warn-level `sync_failed` needs its own "Sync health" panel.
- [email-threading.md](./email-threading.md) — inbound email gotchas (LD ⇄ house): SES overwrites
  our `Message-ID` (so replies match only via the subject heuristic unless we persist the SES id),
  reply-must-reopen-resolved-thread, and the assignee-first notification precedence.
