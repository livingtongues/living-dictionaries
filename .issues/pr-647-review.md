# Review PR #647

Review `livingtongues/living-dictionaries#647` as a merge gate against current `main`.

- [x] Inspect PR metadata, discussion, checks, and complete diff.
- [x] Validate the cross-platform `safe_join` security behavior.
- [x] Validate the `.pnpmfile.cjs` dependency-install workaround and its repo-wide effects.
- [x] Run proportionate targeted verification.
- [x] Report blocking findings and a merge recommendation.

## Review verdict (before fixes)

Do not merge as-is.

The `node:path` `sep` change is correct and applies cleanly to current `main`. POSIX and Win32
simulations accepted normal nested keys and rejected `..` escapes. Targeted ESLint passed, and the
merged tree passed `pnpm check` with 0 errors once the review worktree had the repo's normal local
`svelte-look` and `.env` links.

The `.pnpmfile.cjs` addition leaves the repository's frozen-install contract broken:

1. `pnpm install --frozen-lockfile` fails immediately with
   `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` because `pnpm-lock.yaml` lacks the generated
   `pnpmfileChecksum`.
2. Regenerating the lockfile adds only that checksum and makes a local frozen install pass.
3. `Dockerfile` does not copy `.pnpmfile.cjs` into either the builder or runner install context.
   As the PR stands, Docker silently does not apply the workaround. Once the required lockfile
   checksum is committed, both Docker frozen-install stages fail unless their config copies also
   include `.pnpmfile.cjs`.

The hook removed `prepare` from the installed manifest, but a later isolated-store check showed
that this happens too late: pnpm had already entered its Git-package preparation path and installed
the plugin's development tree. The package already contains `dist/index.mjs` and `dist/index.cjs`,
so that preparation should not happen at all.

GitHub reports no checks for the PR. The branch is 15 commits behind current `main`, but `git
merge-tree` found no conflict.

## Resolution

Implemented the valid path fix directly on current `main`, with a POSIX + Windows regression test.

The proposed pnpm hook was not retained. A clean isolated-store test proved that pnpm reads a
Git-hosted dependency's raw `prepare` script before the root `readPackage` hook and still installs
the plugin's full development tree. Instead, the plugin's two small rules now live in the repo's
ESLint support code, and the Git dependency plus its build-allowlist entry are gone. That removes
the Windows install failure at its source and requires no pnpmfile checksum or Docker configuration
coupling.

Verified with a clean frozen install, the Docker runner's isolated production-install command,
focused tests, typecheck, lint, and a production application build. The Docker image build itself
could not run because this session has no permission to access Mustang's Docker daemon; the final
solution does not change the Dockerfile.
