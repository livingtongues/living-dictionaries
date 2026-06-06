# Parallel `/lib` between house and living — converge the shared substrate

Cross-repo audit of `site/src/lib` in **living-dictionaries** (`~/code/living-dictionaries`)
and **house** (`~/code/house`). Both apps ride the same wa-sqlite/JWT/SQLite/Svelte-5 stack,
so their `lib/` shared-infrastructure folders should stay near-identical. This issue tracks the
asymmetries where one repo's arrangement fixes the other's, plus dead-code cleanup found while
paralleling.

**This file is the canonical checklist; it lives in living's `.issues/` but is split by repo.**
Mirror to `~/code/house/.issues/` if a house-side agent will pick up the house tasks
independently (keep one as source of truth to avoid drift).

## STATUS — all actioned 2026-06-06

All items done **except B6 (overtaken by events)**. House: `check` 0 errors, `test` 540 pass.
Living: `check` 0 errors, `test` 369 pass. No new warnings either side.

- A1 ✅ · A2 ✅ · A3 ✅ · A4 ✅ · B1 ✅ (was already done in living by the time work started) ·
  B2 ✅ · B3 ✅ · B4 ✅ · B5 ✅ · S1 ✅ (code) — **VPS env still needs the rename, see S1** ·
  S2 ✅ (house `$lib/email/send-email.ts` is now byte-identical to living's).
- **B6 — DROPPED (overtaken).** Between the audit and the work, Jacob began consolidating the
  app onto the **flat top-level `svelte-pieces/*` files** (the reverse of the audit snapshot):
  `Modal/ShowHide/Slideover/CopyButton/RichTextEditor` now have real importers, and the flat
  `Modal.svelte`/`Slideover.svelte` import the top-level `portal.ts`/`trapFocus.ts` internally.
  None of the 7 are dead now — deleting them would break the in-flight consolidation. Left
  entirely alone; the barrel/subfolder cleanup is Jacob's migration to own.

Domain-driven differences (livingdictionaries.app↔hvsb.app strings, 2-level vs 3-level admin
tiers, LD dict-roles vs house subscriptions/stripe, LD i18n/mapbox/keyman) are **intentional**
and out of scope. Only the shared substrate is being aligned.

---

## A. House fixes (adopt from living)

- [x] **A1 — Move `load_script_once` out of svelte-pieces, colocate by google-one-tap.**
  House `site/src/lib/svelte-pieces/loadOnce.ts` is imported by `auth/google-one-tap.ts` **only**.
  House has no Mapbox/Keyman, so the file's `load_styles_once` export is **dead code**.
  → Create `house/site/src/lib/auth/load-script-once.ts` (just `load_script_once`), repoint
  `google-one-tap.ts`, delete `svelte-pieces/loadOnce.ts` (incl. dead `load_styles_once`).
  Mirror living's `auth/load-script-once.ts` shape.

- [x] **A2 — Port `verify.test.ts`.** House `auth/verify.ts` is **byte-identical** to living's
  but has no test. Copy living `site/src/lib/auth/verify.test.ts` (8 tests for `verify_auth`:
  cookie, Bearer fallback, precedence, 401 paths).

- [x] **A3 — `insert-client-log.ts` naming.** House names the globalThis handle `g` and uses
  loop var `i` — `g` violates the no-single-letter rule. Living uses `global_object`. Adopt
  living's names (logic is identical otherwise).

- [x] **A4 — `send-email` home.** House's structured/throttled SES sender lives at
  `routes/api/email/send-email.ts`; it's imported by ~6 routes (send-code, compose, reply,
  welcome…). Living keeps the equivalent in `$lib/email/send-email.ts`, the right home for a
  multi-route helper. → Move house's to `$lib/email/send-email.ts` and repoint imports.
  NOTE: the two senders have **drifted ~73 diff lines** (not just domain strings) — reconcile
  logic while moving (see Shared S2).

---

## B. Living fixes (adopt from house)

- [x] **B1 — Toast in google-one-tap (stale TODO).** Living `auth/google-one-tap.ts` still has
  `// TODO(L9): replace with toast once svelte-pieces lands in LD`, a bare `console.error`, and
  **no success toast** — but `svelte-pieces/toast.svelte.ts` + `Toasts.svelte` are already wired
  (used by `components/shell/AuthModal.svelte`, `routes/admin/sync/+page.svelte`, mounted in
  `routes/+layout.svelte`). → Match house: `toast.error(error.message, 10)` on failure +
  `toast.success('Signed in as …', 4)` on success. Drop the stale TODO.

- [x] **B2 — Port `google.test.ts`.** Living `auth/google.ts` is near-identical to house's but
  untested. Copy house `site/src/lib/auth/google.test.ts` (146 lines, `verify_google_id_token`:
  audience required, issuer, email_verified, missing sub/email).

- [x] **B3 — Add missing env test-mocks + vitest aliases.** House aliases **four** env modules
  in `vitest.config.ts` → `mocks/{env-dynamic-private,env-static-private,env-static-public,env-dynamic-public}.ts`.
  Living aliases only `$env/dynamic/private` (+ `$app/environment`). → Add the 3 missing mock
  files (copy/adapt from house) and the 3 aliases. Latent test hazard otherwise: any tested
  module importing those env modules pulls real/undefined values.

- [x] **B4 — R2 client factoring (biggest structural drift).** See diagram below.
  - House: `r2/client.ts` = **attachments** (`get_r2`, `R2_BUCKET`); `r2/snapshot-client.ts` =
    **snapshots**; put/get/delete-attachment **reuse** `get_r2`.
  - Living: `r2/client.ts` = **snapshots** (opposite meaning!); `r2/put-attachment.ts`
    **inlines its own** `get_attachments_r2()` singleton (`R2_ATTACHMENTS_BUCKET`) instead of a
    shared factory.
  - → Refactor living to house's shape: rename `r2/client.ts` → `r2/snapshot-client.ts`
    (`get_r2_snapshot_client`), repoint `db/server/r2-snapshot-builder.ts` (+ its test);
    extract a shared attachments `r2/client.ts` (`get_r2`) and have `put-attachment.ts` /
    `delete-object.ts` consume it. **Align env-var names with house** (see Shared S1).

- [x] **B5 — Fold `invalidateAll` into `logout()` (drop split sign_out).** Living
  `AuthUser.logout()` nulls the user optimistically and does **not** `invalidateAll`; a separate
  `auth/sign-out.ts` wrapper adds it. But `routes/admin/+layout.svelte:26` calls
  `data.auth_user.logout()` **directly**, bypassing the wrapper → admin logout skips re-validation
  and leaves SSR data stale. House folds it all into `logout()` (await API → null user →
  invalidateAll) so every caller is safe. → Adopt house's `logout()`; delete or privatize
  `auth/sign-out.ts` and repoint `components/shell/User.svelte`, `routes/account/+page.svelte`,
  `layout/UserMenu.svelte`, `routes/admin/+layout.svelte` to `auth_user.logout()`.

- [~] **B6 (DROPPED — see status block) — Delete dead svelte-pieces top-level files.** 7 files have **zero importers**; all
  real usage flows through `svelte-pieces/index.ts` barrel → subfolder copies:
  `svelte-pieces/{Modal.svelte, ShowHide.svelte, Slideover.svelte, portal.ts, trapFocus.ts,
  CopyButton.svelte, RichTextEditor.svelte}`. Verify zero imports (grep below) then delete.
  (House has no barrel and no such dupes — components live only in subfolders.)

---

## S. Shared decisions (both repos)

- [x] **S1 — R2 env-var names.** Attachments bucket is `R2_BUCKET` (house) vs
  `R2_ATTACHMENTS_BUCKET` (living). Snapshots bucket is `R2_SNAPSHOTS_BUCKET` in both. Pick one
  name for attachments and align both repos + their VPS env files. **Decision needed from Jacob**
  (changing an env var name means updating the deploy env). Recommend `R2_ATTACHMENTS_BUCKET`
  (explicit, pairs with `R2_SNAPSHOTS_BUCKET`).

- [x] **S2 — `send-email.ts` single source.** Living `$lib/email/send-email.ts` and house
  `routes/api/email/send-email.ts` have drifted ~73 lines. After A4 moves house's to `$lib`,
  reconcile to one implementation (throttle window, multipart shape, dry_run) so the file is
  copy-paste identical modulo domain strings.

---

## Confirmed parallel & healthy (no action — context only)

Byte-identical or differ only by domain strings / intentional domain shape:
`auth/jwt.ts` · `auth/verify.ts` · all 7 `utils/*` · `notifications/notify-admins.ts` ·
`email/send-raw-email.ts` · `debug/remote-log.ts` (≈, import-order only) ·
`admins.ts` helpers (`get_admin_level` + `is_admin_at_least` present in **both**) ·
`AuthUser` core (verify/set_session/singleton) · `email/{addresses,find-or-create-thread,loop-protection}.ts`
(differ only by domain strings).

---

## R2 layout (the S1/B4 picture)

```
              ATTACHMENTS bucket            SNAPSHOTS bucket
HOUSE   r2/client.ts (get_r2, R2_BUCKET)    r2/snapshot-client.ts (get_r2_snapshot_client)
        put/get/delete-attachment reuse      used by snapshot builder
        get_r2  ✅ shared factory

LIVING  put-attachment.ts INLINES            r2/client.ts (get_r2)  ⚠️ named like house's
        get_attachments_r2()  ⚠️ dup         attachments client but is SNAPSHOTS
        (R2_ATTACHMENTS_BUCKET)              used by db/server/r2-snapshot-builder.ts
```

---

## Verification

Per repo, from `site/`:
- `pnpm --filter=site check` → 0 errors, no new warnings
- `pnpm --filter=site test --run` → green (B2/A2 add new green tests)
- `pnpm --filter=site build` then `node build` boots
- `pnpm lint` on changed files

Dead-import check for B6 (run in `living-dictionaries/site`):
```
for f in Modal ShowHide Slideover portal trapFocus CopyButton RichTextEditor; do
  echo "$f: $(grep -rln "svelte-pieces/$f['\"]" src --include=*.svelte --include=*.ts | grep -v 'svelte-pieces/index.ts' | wc -l) importers"
done
```

## Evidence (key file:line refs)
- load_script_once: living `auth/load-script-once.ts` + `auth/google-one-tap.ts:8,31`;
  house `svelte-pieces/loadOnce.ts` (only importer `auth/google-one-tap.ts:9,31`).
- toast TODO: living `auth/google-one-tap.ts` `handle_google_credential` (`TODO(L9)` + console.error).
- logout/sign_out: living `auth/user.svelte.ts` `logout()`, `auth/sign-out.ts`,
  bypass at `routes/admin/+layout.svelte:26`; house `auth/user.svelte.ts` `logout()` (folds invalidateAll).
- env mocks: house `site/vitest.config.ts:16-19` (4 aliases) vs living `site/vitest.config.ts:8-9` (2).
- R2: living `r2/client.ts` (snapshots) + `r2/put-attachment.ts` inline `get_attachments_r2()`;
  house `r2/client.ts` (`get_r2`) + `r2/snapshot-client.ts` (`get_r2_snapshot_client`).
- insert-client-log: house uses `g`/`i`, living `global_object`/`index`.
