# workflow/

Multi-agent / process discipline for working in this repo.

- [concurrent-agents.md](./concurrent-agents.md) — the working tree is shared mutable state:
  check `horse list` + `git status` before any bulk revert/codemod; never checkout a
  grep-derived file list; JSONL-transcript replay is the recovery path (2026-07-12 incident).
  Also covers **prod dictionary DBs as shared state**: how to detect another session
  mid-write (poll `MAX(updated_at)`), what a uniform `updated_at` across a table means, and
  `horse send` as the coordination primitive.
