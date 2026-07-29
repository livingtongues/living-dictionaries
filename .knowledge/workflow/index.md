# workflow/

Multi-agent / process discipline for working in this repo.

- [concurrent-agents.md](./concurrent-agents.md) — the working tree is shared mutable state:
  check `horse list` + `git status` before any bulk revert/codemod; never checkout a
  grep-derived file list; JSONL-transcript replay is the recovery path (2026-07-12 incident).
  Also covers **prod dictionary DBs as shared state**: how to detect another session
  mid-write (poll `MAX(updated_at)`), what a uniform `updated_at` across a table means, and
  `horse send` as the coordination primitive.
- [fanout-verification-lanes.md](./fanout-verification-lanes.md) — the two ways a parallel
  verification lane lies: it silently dies on the shared subscription **session limit** (respawn the
  tail on Codex — a different subscription — rather than waiting), or it returns schema-valid
  `checked: true` output **without ever reading the evidence file**. Coverage + validity gates pass
  a lying lane; only a **provenance** check of the lane's transcript catches it (2026-07-28 Ponca
  round-3 audit).
