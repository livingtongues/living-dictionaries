# Supabase → SQLite cutover: data conversions & rehearsal findings

Durable gotchas from the full-corpus cutover rehearsal (2026-07-02, all 2,229 dicts / 546k
entries pushed live to the `living` VPS). The flip record is
[production-cutover-record.md](./production-cutover-record.md); the migrator is
`scripts/supabase/cutover/`. This page records the non-obvious things the rehearsal
taught that aren't visible from reading the code.

## The two silent-data-loss bugs the rehearsal caught (fixed)

1. **`looks_like_html` misfired on any leading `<`.** The read-time shim + the cutover converter
   both gate on this heuristic. The old `/^\s*</` treated `<< pa` (linguistics citation/borrowing
   marker) and `< Odia < Telugu < English` (etymology chains — **sora-language-project**, the 50k-
   entry dict, 618 such entries) as HTML → the DOMParser swallowed `<<word` as a bogus tag and
   **dropped the text entirely**. Fix: require a real tag open — `<` + tag-name letter + (space/`>`/
   `/`), or `</`/`<!`. This also excludes `<https://…>` autolinks (tag-name chars then `:`). The fix
   lives in `site/src/lib/markdown/html-era-shim.ts` so it repairs the LIVE app's rendering too, not
   just the migration. Detection method that found it: compare the letter-multiset (any script) of
   original-HTML-textContent vs markdown-rendered-back-textContent; any dropped letter = real loss.

2. **Undeclared `lo{n}` orthographies.** Some dicts carry native-script alternate spellings keyed
   `lo1`/`lo2` in `entries.lexeme` / `sentences.text` but declared `orthographies = null` (prod:
   6 dicts, **malapulaya** 388 entries in Malayalam script). `map_orthographies` built `lo_to_code`
   only from the declared array → nothing to rewrite the key to, and the `get_headword` fallback
   only consults REGISTERED codes, so the native spelling was invisible. `synthesize_missing_
   orthographies` (mappers.ts) scans mapped rows for used-but-undeclared `lo{n}`, registers an
   `orth{n}` entry per index, rewrites the keys, and writes the registry back to the catalog.

## The scaling wall: Tiptap leaks heap per conversion

`html_to_markdown` (generateJSON → headless Editor → serialize) retains **~0.3–0.75 MB of GC-proof
heap per call** — measured identical under happy-dom AND jsdom, so it's in Tiptap/ProseMirror, not
the DOM shim. A notes-heavy dictionary can exhaust any Node heap mid-dict. Solution that worked:
run conversions in a **disposable child process** (`richtext-child.ts` ↔ `richtext-pool.ts`, NDJSON
over stdin/stdout) that is killed and respawned on a count/byte budget; the parent (`migrate.ts`)
**never imports the tiptap chain**, so its heap stays flat across the whole corpus. (Earlier
attempts — periodic happy-dom `Window` refresh, in-process pass-budget + `--skip-existing` resume
loop — only half-worked; the child-process isolation is the real fix. `richtext.ts` still holds the
in-process converter for the child + unit tests.)

## Conversion audit outcomes (rich text → markdown)

Corpus-wide scan (`audit-rich-text.ts`): 47,825 HTML values across about/grammar/notes. Decisions
(all live in `site/src/lib/markdown/extensions.ts` — editor, converter, and reader share ONE set):
- **tables** (317 values, grammar paradigms) → `@tiptap/extension-table` TableKit, serialized as
  cleaned raw-HTML blocks inside markdown (`clean-tables.ts`). Converting to real GFM tables is
  deferred (`.issues/future/markdown-tables.md`) — GFM can't do the colspan/rowspan some linguistic
  paradigms use, needs eyeballing.
- **underline** (1,039) → `[…]{.underline}` Pandoc span (`legacy-underline.ts`), NOT dropped: the
  audit found real semantics (phoneme letters like `m<u>e</u>n`, run-in headings). Dotted display;
  one CSS rule in typography.css to restyle later. Unwrapped inside `<a>` (redundant + its brackets
  corrupt link syntax).
- **smallcaps** (50) → `[…]{.smallcaps}` (`small-caps.ts` + `markdown-it-pandoc-spans.ts`).
- text-align (646) dropped; `<oembed>` (5) → plain links; `<h4>` (112) → paragraph (levels 1–3).
- Rendered markdown needs `sanitize_rich_text` (xss defaults + `span[class]`) not bare `xss`, or the
  smallcaps/underline class is stripped. `xss` is CJS → `import xss from 'xss'; const { FilterXSS,
  getDefaultWhiteList } = xss` (named imports break Vite dev SSR).

**Residual mismatches are benign** (0 data loss after the two fixes): markdown-escape backslashes and
list-marker text-extraction artifacts render identically; `**bold**`/`*italic*` adjacent to
CJK/Devanagari/Arabic render as literal asterisks (markdown-it flanking doesn't recognize non-Latin
word boundaries — cosmetic, a future `markdown-it-cjk` candidate).

## Schema-drift converge (prod predates the consolidated initial)

The live `shared.db` was provisioned from the PRE-squash migration chain, and `CREATE TABLE IF NOT
EXISTS` never re-runs — so columns added by later consolidations are silently missing (found:
`dictionaries.about/citation/grammar/write_in_collaborators`; earlier: the whole `dictionary_partners`
table). ALWAYS run `converge-shared-drift.ts` on a freshly-pulled `shared.db` before migrating into
it (idempotent: ALTER ADD COLUMN for missing cols, replay CREATE for missing tables/indexes/triggers,
report-only on anything else). `river.db` (created on the NEW system) was drift-free.

## Hard-delete model (no `deleted` column on dict tables)

The dict schema hard-deletes (a `deletes` tombstone log), unlike Supabase's soft-delete `deleted`
column. So: mappers emit NO `deleted`; `read_dict_table` filters `deleted IS NULL` at read time;
live children orphaned by a soft-deleted parent are `prune_orphans`'d post-insert (iterative
`foreign_key_check` sweep, recorded in the manifest so `verify.ts` subtracts them from pg parity).
This was the real root cause of the long-mislabeled "pre-existing migrate.test breakage."

## Identity & the push (prod-id-wins)

`users.email` is UNIQUE COLLATE NOCASE. Migration runs INTO a pulled copy of prod `shared.db`; for
each Supabase user matching an existing VPS user by email, the VPS id is kept and the Supabase id is
remapped in ALL migrated user-id columns (`remap.ts`) — so `river.db`, `api_keys`, chat, client_logs
stay byte-untouched and the manager keeps their role. Push is safe when living has ~zero drift since
the pull (check river's last-write, message/chat counts, client_logs count). Blue/green both mount
`/data` → stop BOTH, swap `shared.db`, `rm` stale `-wal`/`-shm`, start both. rsync dict DBs additively
(never `--delete`; `river.*` isn't in the migrated dir so it's untouched). Checkpoint
(`wal_checkpoint(TRUNCATE)`) every migrated DB first so the `.db` is self-contained. On restart the
snapshot builder auto-rebuilds all dicts (their `snapshot_uploaded_at` is NULL).

## Phase-B delta learnings (2026-07-03, the real cutover)

- **U+2028/U+2029 break NDJSON protocols.** `JSON.stringify` legally leaves LINE/PARAGRAPH
  SEPARATOR unescaped, and node `readline` splits lines on U+2028 (at least on v24.16) — the
  richtext child received a truncated JSON line and died, twice, on the one grammar containing
  U+2028. Fix: `to_ndjson_line()` escapes both, both directions of the pipe. If any agent builds
  another line-delimited JSON protocol, reuse this.
- **A paragraph that is entirely `{…}` is eaten at render** by markdown-it-attrs' end-of-block
  rule (`allowedAttributes` filters application, not consumption). One migrated value patched
  (brace-escaped); the live-editor bug is `.issues/markdown-brace-paragraph-loss.md`. house has
  the same pandoc-spans setup → same latent bug.
- **`snapshot_uploaded_at` must survive the catalog upsert.** `map_dictionary` deliberately omits
  the column; `migrate.ts` NULLs it only for content-rebuilt dicts. Confirmed end-to-end: the
  Phase-B boot logged "7 need fresh → Uploaded 7/7" instead of resweeping all 2,229.
- **Delta flag rules:** never `--skip-existing` on a `--since` delta (the manifest filter skips
  the changed dicts); rename the previous manifest first so `verify.ts` scopes to the delta. The
  old `--conversion-budget`/exit-75 loop is gone — child recycling is internal to richtext-pool.
- **Deleted-dicts gap:** the delta reads live rows only; dicts deleted in Supabase between runs
  must be checked by hand (`WHERE deleted > <since>` — was zero).
- **verify.ts summary via console.log** — record-logs (imported by config-supabase) hijacks
  console.info to file-only; a "silent" verify actually passed.
- **DNS-flip rollback record:** apex was `A 76.76.21.21` (Vercel), DNS-only; now `A 72.61.6.252`
  proxied. CF token gaps for agents: `Zone · Dynamic Redirect · Edit`, `Zone · Zone Settings · Read`.
