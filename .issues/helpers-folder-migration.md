# Helpers folder feature-home migration

Implement the deferred 2026-07-21 parity-review cleanup by removing the remaining domain code from
`site/src/lib/helpers/` and updating every consumer without changing behavior.

## Scope and staged plan

- ✅ Inspect the parity review, current worktree, existing issues, knowledge index, helper contents,
  and all import consumers.
- ✅ Preserve the unrelated in-progress media/R2 work; limit overlapping-file edits to import paths.
- ✅ Move gloss ordering and vernacular-language naming into `site/src/lib/gloss/`.
- ✅ Split example-sentence ordering and its tests into `site/src/lib/example-sentence/`.
- ✅ Move entry display helpers into `site/src/lib/entry/`, correcting the misspelled
  `get_local_orthagraphies.ts` filename while preserving the exported function name.
- ✅ Move orthography, invite, and tag helpers into `site/src/lib/orthography/`,
  `site/src/lib/invite/`, and `site/src/lib/tag/`.
- ✅ Rewrite all imports, confirm no files or references remain under `$lib/helpers`, and inspect the
  resulting diff for accidental changes to pre-existing work.
- ✅ Validate moved Svelte consumers with the Svelte analyzer, run focused tests followed by project
  check/lint/tests, and run representative svelte-look visual checks in light/dark.

## Verification notes

- `pnpm --dir site exec vitest run ...` for the five moved test modules: 25/25 passed.
- `pnpm check`: passed with 0 errors (43 existing warnings).
- `pnpm lint`: passed.
- Full `pnpm test -- --run ...` unintentionally ran the entire suite because the package script
  forwarded the filter after an extra `--`: 265 files passed, 1 skipped; 1,905 tests passed,
  3 skipped; only two unrelated, pre-existing `upload-media.test.ts` expectations failed because
  the concurrent media work now supplies `file_size`.
- Svelte analyzer completed on the representative `EntryFilters.svelte` consumer. It reported the
  existing `$sources` store auto-subscription as though it were a rune variable; `svelte-check`
  accepts the component.
- Svelte-look rendered the EntryFilters orthography story and the full dictionary-home manager story
  in both light and dark. The first home render exposed a stale story fixture missing
  `about_is_too_short`; added the one-line mock and reran successfully.
- `git diff --check`: passed. Six direct moves are byte-identical to their HEAD versions; the only
  logic-file split is `order_example_sentences` and its tests moving from glosses to
  `example-sentence`.
- Updated the orthographies knowledge pointer and the structured-grammar issue pointer. No AGENTS.md
  architecture update is needed: the shared convention already describes feature-owned folders and
  the broader multi-repo legacy-folder migration remains in progress.
