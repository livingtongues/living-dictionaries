# Scheduled jobs (`.cron/`)

Home for this repo's recurring/scheduled agent work and the reports it produces — kept out of
`.issues/` (those are active *plans*, not recurring outputs).

- **`log-review.md`** — the live, committed definition of the daily log-and-fix review (reviews the
  `new.livingdictionaries.app` VPS `client_logs`).
- **`log-reviews/`** — dated output of that review (`YYYY-MM-DD.md`), accumulated as history.

## How crons run

Jobs are spawned by **horse's scheduler**. It discovers job definitions from **two** places:

1. **This repo's `.cron/` folder** (committed, reviewable, machine-scoped) — `log-review.md` lives here.
2. The machine-local store `~/.local/share/horse/cron/` — for ad-hoc / one-time jobs (`horse cron add`).

A repo job is any `*.md` directly in `.cron/` (not `index.md`, non-recursive) with a recurring
`every:` cron expression in its frontmatter. **Run-state stays machine-local** — the `last_run` /
`runs[]` sidecar is written to `~/.local/share/horse/cron/<project>--<name>.json`, never committed.

Repo jobs MUST declare **`runs_on:`** — the machine (`tuf` / `mustang`) allowed to fire them — so a
committed def checked out on multiple machines never fans out into N× duplicate spawns. A repo job
with no `runs_on` is listed but never runs (fail-safe). LD jobs run on **mustang** (which has SSH
access to the living VPS).

Repo job ids are namespaced `<project>/<filename-stem>` (e.g. `living-dictionaries/log-review`). Edit
a repo job by editing its file and committing; `horse cron run <id>` still triggers one on demand.

## Jobs scheduled against this repo

| id | source | schedule | runs | output |
|---|---|---|---|---|
| `living-dictionaries/log-review` | `.cron/log-review.md` (repo, `runs_on: mustang`, `model: claude-opus-4-8`) | `every: 31 22 * * *` (daily 22:31 UTC = 06:31 SGT) | `.claude/commands/log-and-fix.md` end-to-end | `.cron/log-reviews/YYYY-MM-DD.md` + chat summary |

> The `log-and-fix` *command* lives at `.claude/commands/log-and-fix.md` (slash menu + the cron read
> it there) — it is NOT a cron definition. `log-review.md` just invokes it.
