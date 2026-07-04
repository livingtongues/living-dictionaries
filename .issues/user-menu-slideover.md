# Reinstate side slideover for avatar user menu (LD + house)

Dropdown user menu didn't stay in place on scroll. Replaced with right-side Slideover in both LD and house.

Requirements from Jacob:
- Side menu (slideover from right) on avatar click, both apps
- Uniform padding, icons on the LEFT of all items
- Color scheme item: just "System"/"Light"/"Dark" (no "Appearance:" prefix)
- No separate account settings item — name/email header block links to /account with a gear icon on the RIGHT

## Tasks
- ✅ LD: User.svelte → Slideover (RTL respected via `page.data.t('page.direction')` like Header); deleted orphaned `components/ui/Menu.svelte`
- ✅ LD: UserMenu.svelte restructure — account header link + gear, left mdi icons (key/forum/translate/logout/wrench), chat badge pushed right, persona check now `var(--primary)` mdi/check
- ✅ LD: ColorSchemeToggle non-compact label = scheme only (title attr keeps "Appearance: X")
- ✅ house: new clean `components/ui/Slideover.svelte` (snake_case props, theme-var CSS; LD's sp-* one depends on uno-preflights vars house lacks). Gotcha caught in e2e: backdrop must be `position: fixed; inset: 0` (wrapper is only panel-wide)
- ✅ house: User.svelte → Slideover (dropped clickoutside/fly)
- ✅ house: UserMenu.svelte restructure (same shape as LD)
- ✅ Verified: LD svelte-look UserMenu light+dark; house svelte-look admin flavor light+dark; headless e2e on both dev servers (menu opens, stays fixed on scroll, backdrop click closes, no pageerrors); `pnpm check` 0 errors + eslint clean in both repos
