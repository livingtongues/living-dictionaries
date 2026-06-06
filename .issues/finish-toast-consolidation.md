# Finish landing the svelte-pieces toast in LD (+ cross-repo cleanup)

Origin: stale `// TODO(L9): replace with toast once svelte-pieces lands in LD.` in
`site/src/lib/auth/google-one-tap.ts`. The svelte-pieces toast already landed (its
`toast.svelte.ts` is byte-identical to tutor + house), but LD never finished wiring it up.

## Findings
- LD had a SPLIT-BRAIN: old `components/ui/Toasts.svelte` (black-only, ms-based) mounted in root
  layout + used by AuthModal; new full-featured `svelte-pieces/Toasts.svelte` mounted NOWHERE, so
  `admin/sync`'s `toast.success/error` rendered nothing (latent bug).
- `toast.svelte.ts` logic is identical in tutor / house / LD → feature parity already exists in code.
- House is already fully consolidated on svelte-pieces toast.
- No `/login` route exists in LD or house → the `if (url.pathname === '/login')` branch in both
  google-one-tap.ts was dead code.

## Decisions (Jacob)
- Q1 consolidate LD + delete old `components/ui/Toasts.svelte` — YES
- Q2 AuthModal: `toast.error(msg, 10)` for errors, `toast(msg, 4)` for sent-code — YES
- Q3 google-one-tap: mirror house (error + "Signed in as …" success) — YES
- Q4 keep each repo's Toasts.svelte CSS (LD theme-vars, house hardcoded) — KEEP, parity only
- Q5 docs: SKIP, and DELETE tutor's TOAST_API.md (not needed)
- Follow-up: remove `/login` branch in BOTH LD + house google-one-tap → just `await invalidateAll()`

## Tasks
- [x] LD root `+layout.svelte`: mount `svelte-pieces/Toasts.svelte`, drop old dynamic import
- [x] LD `AuthModal.svelte`: import svelte-pieces toast; errors→`toast.error(msg,10)`; sent-code→`toast(msg,4)`; drop TEN_SECONDS/FOUR_SECONDS consts
- [x] LD `google-one-tap.ts`: replace console.error+TODO with `toast.error`; add success toast; remove `/login` branch + unused `goto`
- [x] Delete LD `components/ui/Toasts.svelte`
- [x] House `google-one-tap.ts`: remove `/login` branch + unused `goto`
- [x] Delete tutor `svelte-pieces/TOAST_API.md`
- [x] Verify: `pnpm --filter=site check` (LD + house) = 0 errors, no new warnings; lint clean
- [x] LD `pnpm build` + `node build` boots; curl `/`, `/account`, `/admin/sync`, `/about` → all 200 (admin/sync toasts now actually render)

## DONE — all tasks complete, awaiting Jacob's confirmation
