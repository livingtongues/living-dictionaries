# api/ — public/programmatic API surfaces

Knowledge about LD's outward-facing APIs (beyond the internal `_call.ts` endpoints).

- [v1-write-api.md](./v1-write-api.md) — the agent-friendly `/api/v1` bulk write API + per-dictionary API keys (design rationale, the "behaves like a human edit" reuse, gotchas).
- [snapshot-cdn.md](./snapshot-cdn.md) — the Cloudflare Cache Rule that preserves snapshots' origin `max-age=120` at both browser and edge layers.
