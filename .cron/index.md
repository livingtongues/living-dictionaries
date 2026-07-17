# Scheduled jobs (`.cron/`)

Home for this repo's recurring/scheduled agent work and the reports it produces — kept out of
`.issues/` (those are active *plans*, not recurring outputs).

- **`log-reviews/`** — dated output of the daily log-and-fix review (`YYYY-MM-DD.md`; reviews the
  `new.livingdictionaries.app` VPS `client_logs`), accumulated as history. Since 2026-07-06 the
  review is **spawned by the horse nightly orchestrator** (`horse/nightly-orchestrate`, tier 1 of
  `~/code/horse/.cron/fleet.md`) — there is no standalone `living-dictionaries/log-review` cron
  entry anymore. The playbook is still this repo's `.claude/commands/log-and-fix.md`; reports
  follow `~/code/horse/.cron/report-style.md`.
- **`seo-reviews/`** — dated output of the monthly **SEO/GEO discoverability** loop (Loop Library
  #006, adopted 2026-07-16). Crawls the priority public page-types on production, asserts the SEO
  invariants + a target-query benchmark, ranks gaps. Playbook: `.claude/commands/seo-review.md`.
  Audit-first (read-only) until promoted.
- **`api-conformance-reviews/`** — dated output of the **v1 API contract-conformance** loop (Loop
  Library #076, adopted 2026-07-16). Reconciles the OpenAPI spec against the `/api/v1` handlers +
  tests into a requirement ledger. Playbook: `.claude/commands/api-conformance-review.md`.
  Audit-first until promoted; also worth a manual run after each v1 milestone.

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
| `living-dictionaries/fill-translations` | `.cron/fill-translations.md` (repo, `runs_on: mustang`, `claude-opus-4-8`) | weekly `every: 0 6 * * 1` (Mon 06:00 machine-local) | AI-fill missing i18n translations + `en_changed` triage via `.claude/commands/fill-translations.md`; refresh seed + push `main` | commit + summary in its session |
| `living-dictionaries/seo-review` | `.cron/seo-review.md` (repo, `runs_on: mustang`, `claude-opus-4-8`) | monthly `every: 10 22 1 * *` (1st, 22:10 UTC) | SEO/GEO discoverability audit of production page-types via `.claude/commands/seo-review.md`; audit-first | dated digest in `.cron/seo-reviews/` |
| `living-dictionaries/api-conformance-review` | `.cron/api-conformance-review.md` (repo, `runs_on: mustang`, `claude-opus-4-8`) | monthly `every: 10 22 15 * *` (15th, 22:10 UTC) + post-milestone | v1 OpenAPI ↔ code conformance ledger via `.claude/commands/api-conformance-review.md`; audit-first | dated digest in `.cron/api-conformance-reviews/` |
| `living-dictionaries/invoice-2026-07-24` | `.cron/invoice-2026-07-24.md` (repo, `runs_on: mustang`) | one-time `at: 2026-07-23T23:00` | Living Tongues invoice draft | summary in the Horse chat session |

> The daily log review is no longer a cron here — the **horse nightly orchestrator** spawns it
> (see `~/code/horse/.cron/fleet.md`). The `log-and-fix` *command* stays at
> `.claude/commands/log-and-fix.md`; its output stays in `.cron/log-reviews/`.
