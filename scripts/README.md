# `scripts/` — standalone LD tooling

Out-of-workspace tooling: prod-DB surgery, local data helpers, and the dev SQLite query CLI. It is
**not** the site's build tooling (that lives in `site/scripts/`, wired into `site/package.json`).

Most of what is here is **history**, not maintained tooling. This file is the map of what is safe to
run, what mutates production, and how each thing is invoked.

## Working directory & install

`scripts/` is a separate package with its own lockfile and is **NOT a pnpm workspace member** (the
workspace is `site` only). Install from inside this folder, or pnpm will install the root workspace
instead:

```bash
cd scripts && pnpm install --ignore-workspace
```

Everything below is written to be run **from the repo root** unless noted; only the package aliases
(`pnpm test` / `pnpm typecheck` / `pnpm sqlite-query`) need this folder as the cwd.

## The map

| Executable | Runs where | Touches | Mutates | Dry run |
|---|---|---|---|---|
| `sqlite-query.sh` | local dev machine | the **browser's** wa-sqlite DBs via the Vite dev proxy | only if your SQL writes | n/a — you choose the SQL |
| `import-report/artifact.py` | imported by an import's own builder | nothing — renders HTML | ❌ never | n/a |
| `import-audit/audit.py` | local, before any import write | final entry payload + optional decision/relationship ledgers | ❌ never | n/a — audit only |
| `bucket-classification/build-assignments.js` | local, node ESM | reads `/tmp/dict-stats.jsonl` → writes `bucket-classification/bucket-assignments.csv` | local file only | n/a |
| `bucket-classification/apply-assignments.js` | **prod app container** (CJS via stdin) | `dictionaries.bucket` + `updated_at` in prod `shared.db` | ⚠️ **yes, production** | ❌ none — back up first |
| `one-off/*.cjs` | **prod app container** (CJS via stdin) | prod `shared.db` / per-dict DBs | ⚠️ yes, when run | `DRY=1` |
| `spreadsheet_helpers/bum_tones/integrate_tones.ts` | local, vitest / tsx | in-memory arrays → a local `.txt` | local file only | n/a |
| `constants.ts` | imported | — | — | — |

`import-report/` and `import-audit/` are the exceptions to "most of this folder is history": they
are **maintained tooling**. The former is the shared HTML shell every import-conversation
report/preview artifact is built on (guide §2.8); the latter is the mandatory fail-loud gate over
the final entry payload, after every promotion/expansion step.
An import's own builder lives in its `~/import-work/<dict>/` folder and imports this — see
`~/import-work/ponca/report.py` for a full worked example. Before this existed each import
copy-pasted its own `artifact.py`, and the three copies drifted (two shipped a permanently
invisible "expand all" button; all three used a font stack that breaks diacritics on Mac Chrome).

`one-off/` is a **dated archive of already-applied migrations**, kept as reference for writing the
next one — not a menu. Several can no longer run at all (the 2026-07-14/15 grammar scripts read
`dictionaries.grammar`, a column since dropped in the structured-grammar cutover). Read the header
comment of any file before assuming it still applies; the matching `.issues/` file is its real
history.

## Environment

| Variable | Meaning |
|---|---|
| `DATA_DIR` | Where the server DBs live: `site/.data` locally, `/data` inside the prod container (bind-mounted from the host's `/opt/hosting/data`). The prod scripts default to `/data`. |
| `MIGRATIONS_DIR` | Only `one-off/2026-07-15-grammar-cutover-warm-and-backfill.cjs` — where the per-dict `.sql` migrations were copied into the container. |
| `DRY` | `DRY=1` → preview, no writes (see below). |

Gitignored, never committed: `.env`, `service-accounts.ts`, `sheets-viewer-SA.json` (retired Google
Sheets lane) and `supabase-creds.private` (legacy Supabase read access; the connector code exists
only in git history).

## Dry-run convention

Two conventions exist here — know which one you are holding:

- **Committed `one-off/*.cjs` — write by default.** `DRY=1` previews (`[dry run] would update …`).
  Running one with no env var **writes**.
- **New live surgery — safe by default.** Per the `database` skill (`.claude/skills/database/SKILL.md`,
  standing decision 2026-07-25): print the plan, exit unless `APPLY=1`, write in ONE transaction,
  print the after-state + `integrity_check`. Write new scripts this way; a one-off data repair is a
  script, never a migration.

Either way: idempotent, bump `updated_at` so clients pull the change, and never set `dirty`
server-side (that is the client-push flag — setting it echoes rows back).

## Canonical invocation

**Dev SQLite CLI** (needs `pnpm dev` running + the relevant page open in the browser; full details in
`.claude/skills/sqlite-query/SKILL.md`, which always uses the absolute path):

```bash
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh --status
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh "SELECT id, name FROM dictionaries LIMIT 5"
/home/jacob/code/living-dictionaries/scripts/sqlite-query.sh --dict my-dictionary "SELECT COUNT(*) FROM entries"
```

**Prod scripts** are piped to `node`'s **stdin** inside the app container — that is why they are CJS
(`require`) even though this package is `"type": "module"`; do not run them as files here. Back up
first, preview, then apply:

```bash
ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
ssh living 'docker exec -i -e DRY=1 sveltekit_blue node' < scripts/one-off/<script>.cjs
ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/<script>.cjs
```

`sveltekit_blue` is the primary (blue/green share the same `/data` mount). `apply-assignments.js`
additionally needs its CSV staged on the host at `/opt/hosting/data/bucket-assignments.csv`
(container path `/data/bucket-assignments.csv`); its own header comment carries the full sequence.

**Locally** the same scripts run against the dev data dir:

```bash
DATA_DIR=site/.data node scripts/one-off/<script>.cjs      # add DRY=1 to preview
node scripts/bucket-classification/build-assignments.js /tmp/dict-stats.jsonl
```

## Verification

Root `pnpm lint` **ignores `scripts/**`** and root `pnpm check` does not cover it. Run both the
package checks and the Python payload-auditor suite:

```bash
cd scripts
pnpm test --run    # vitest — the bum_tones helper suite
pnpm typecheck     # tsc --noEmit over the TS in this package
cd ..
python3 -m unittest discover -s scripts/import-audit -p 'test_*.py'
```

For anything that touches production, the verification is a `DRY=1` (or plan-only) run first, then a
read-back query after applying — plus a note in the relevant `.issues/` file, which is the only
history that change will have.
