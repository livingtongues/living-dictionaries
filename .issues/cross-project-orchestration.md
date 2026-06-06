# LD master plan — RETIRED (thin pointer)

The Svelte-5 / SQLite / VPS migration is **done** and **staging is live** at
`https://new.livingdictionaries.app`. This master plan has been split apart; nothing actionable
remains here. **Delete this file once the cutover lands.**

Where the content went:
- **Remaining work — the cutover runbook** (deploy mechanism, VPS env-var contract, live
  verification checklist, production legacy cutover, deferred backlog) → **`.issues/cutover.md`**.
- **Durable shared-stack conventions** (LD ↔ house contract, sync invariants, rejected decisions,
  R2/media boundary, deploy-via-webhook) → **`.knowledge/migration/shared-stack-conventions.md`**.
- **Per-milestone migration gotchas** → `.knowledge/migration/*` (build/deploy, runes, eslint,
  sqlite read, write/sync, real auth, media upload, dict-sync invariants, UnoCSS plugin swap).
- **house** open work → tracked in house's own `.issues/`.
