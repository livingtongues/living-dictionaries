# Admin backend

Knowledge for the local-first super-admin area (`/admin/*`).

- [admin-backend.md](./admin-backend.md) — the 2026-06-25 port of house's admin features
  (schema-graph rewrite, team chat, ntfy dashboard, message triage) + the cross-repo
  near-identical-file relationship with `house` that must be kept in sync.
- [chat-large-attachments.md](./chat-large-attachments.md) — the presigned direct-to-R2 chat upload
  pipeline (500 MB, inline video/audio playback, room dropzone): why presigning rather than a bigger
  body limit, why the room id lives in the object key, the harmless AWS presign checksum param, the
  house-only pnpm overrides, and the SVG-inline XSS this closed.
- [ai-triage-pipeline.md](./ai-triage-pipeline.md) — the LLM inbound-email triage pipeline
  (`$lib/agent/*`): categories, routing, what diverges from house's version, and the env gate.
- [analytics-telemetry.md](./analytics-telemetry.md) — cross-repo `client_logs` analytics shapes:
  the three-signal bot classifier (frequency-bot two-signal gate), the `bot:` rollup namespace,
  and why warn-level `sync_failed` needs its own "Sync health" panel.
- [user-report-triage.md](./user-report-triage.md) — turning a vague "it's broken" report into a
  diagnosis: what `message_threads.url` gives away, the three places that prove a row id never
  existed, empty `breadcrumbs` = a link from outside the app, and how to widen one anecdote into a
  population query.
- [email-threading.md](./email-threading.md) — inbound email gotchas (LD ⇄ house): SES overwrites
  our `Message-ID` (so replies match only via the subject heuristic unless we persist the SES id),
  reply-must-reopen-resolved-thread, and the assignee-first notification precedence.
