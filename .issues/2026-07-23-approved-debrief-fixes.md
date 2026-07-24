# Execute approved 2026-07-23 debrief fixes

Approved work from the July 23 log, nightly, and parity reviews. Preserve the pre-existing,
fully-verified three-file parts-of-speech snake_case diff and all unrelated worktree changes.
Leave all work uncommitted and undeployed.

- [x] Require exact configured SES/SNS `TopicArn` before handling notifications or subscription
  confirmations; cover missing, mismatched, and matching topics.
- [x] Repair clean legacy duplicate `dictionary_roles` during admin full resync without discarding
  legitimate dirty roles; add focused convergence coverage.
- [x] Keep source editing open on duplicate/write failure, validate existing slugs, provide an
  existing-source reuse path, close only after confirmed writes, and add privacy-safe
  `source_save_failed` telemetry plus tests.
- [x] Persist exactly one `admin_analytics_computed` timing event per uncached analytics calculation
  without per-query noise; add tests.
- [x] Rename internal i18n helper exports in `change-locale.ts` and `locales.ts` to snake_case while
  preserving locale codes, cookie names, generated catalog keys, and behavior.
- [x] Focused verification: 69 tests across all five workstreams; `pnpm check` (0 errors); targeted
  ESLint clean; duplicate-source story visually verified in light and dark at 640×900.
- [ ] Repository-wide test/lint gate after concurrent media work settles. Full lint currently reaches
  only four unrelated in-progress assertions in `validate-media-bytes.test.ts`; do not alter them.

Explicitly deferred/threshold-triggered: editor OPFS replacement; waveform/network investigation;
low-frequency recursion investigation.
