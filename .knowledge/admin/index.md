# Admin backend

Knowledge for the local-first super-admin area (`/admin/*`).

- [admin-backend.md](./admin-backend.md) — the 2026-06-25 port of house's admin features
  (schema-graph rewrite, team chat, ntfy dashboard, message triage) + the cross-repo
  near-identical-file relationship with `house` that must be kept in sync.
- [ai-triage-pipeline.md](./ai-triage-pipeline.md) — the LLM inbound-email triage pipeline
  (`$lib/agent/*`): categories, routing, what diverges from house's version, and the env gate.
