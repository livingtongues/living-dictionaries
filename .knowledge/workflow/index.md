# workflow/

Multi-agent / process discipline for working in this repo.

- [concurrent-agents.md](./concurrent-agents.md) — the working tree is shared mutable state:
  check `horse list` + `git status` before any bulk revert/codemod; never checkout a
  grep-derived file list; JSONL-transcript replay is the recovery path (2026-07-12 incident).
