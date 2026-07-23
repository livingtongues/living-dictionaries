# Approved nightly review fixes — 2026-07-22

Execute the approved translation-integrity and viewer poisoned-file recovery items from the July 22 nightly and log reviews. Leave changes uncommitted.

## Translation integrity

- [x] Discover BCP-47-style hyphenated catalog filenames through a registry-validated helper.
- [x] Seed fresh/reseeded databases from both `zh-CN.json` and `zh-TW.json`.
- [x] Commit a locale switch and its fetched rows as one successful store snapshot.
- [x] Ensure a failed switch cannot save retained old-language rows under the requested locale.
- [x] Add focused catalog seed and store regression tests.

## Viewer poisoned-file recovery

- [x] Carry the one-replacement claim across worker respawns and leader hand-offs during the page session.
- [x] Generate the remote-log session id synchronously when deep-link dictionary boot first requests it, and retain that id when root logging initializes.
- [x] Preserve the signed-in editor boundary; editor replacement still requires a durable external write ledger.
- [x] Run focused and full proportional verification.

## Verification

- Focused Vitest: 6 files, 45 tests passed.
- Full Vitest: 254 files passed + 1 skipped; 1,816 tests passed + 3 skipped.
- `pnpm check`: 0 errors (42 existing warnings).
- `pnpm lint`: clean.
- `git diff --check`: clean.
