# Custom ESLint config + finishing the runes migration (LD-A2, 2026-06-04)

How LD got `pnpm lint` to 0 errors and re-enabled the pre-commit hook, between M2c and M3.
The config itself is self-documenting in `eslint.config.js`; this page records the decisions
and the non-obvious gotchas.

## Decision: fully custom flat config (not antfu)
`@antfu/eslint-config@2` pins `eslint-plugin-svelte@2.43`, whose `svelte/indent` **stack-overflows
on Svelte 5 runes**. We did NOT try to override antfu — instead we **ported the hand-written flat
config from `living-dictionaries-example`** (the finished destination repo, same app). Same stack as
house: eslint 10, `eslint-plugin-svelte@3` + `svelte-eslint-parser@1`, `@stylistic`, `import-x`, `n`,
`perfectionist`, `regexp`, `unicorn`, `jsonc`, `@vitest/eslint-plugin`; **canonical rule namespaces**
(`@typescript-eslint/*`, `@stylistic/*`, `import-x/*`) so error ids match config keys. Scope = active
`site/` + root; `packages/**`, `supabase/**`, `site/e2e/**`, vendored `lz-string`, `.vercel`/`build`
ignored. Lockfile drift was eslint-only (verify with `git diff pnpm-lock.yaml`).

- `lint`/`lint:fix` = `eslint --cache [--fix] --quiet` (errors-only gate; warnings stay visible).
- Adopting the config + running `lint:fix` reformats **~125 files repo-wide** — but it's **purely
  stylistic and behavior-neutral** (perfectionist import-sorting, quote/comma normalization,
  `import-x/consistent-type-specifier-style` splitting inline `type` imports). Expected one-time cost;
  house did the same. Land it so the tree is stable under the hook.

## We FINISHED the runes migration instead of disabling rules (Jacob's call)
The lint errors traced to legacy stragglers the M2c codemod left: 7 `@migration-task` components +
vendored svelte-pieces still on Svelte-4 props/slots. We converted them (references: house/tutor/
example svelte-pieces — **keep LD's UnoCSS `<style>` blocks verbatim**).

### Svelte-pieces conversion gotchas
- **In runes mode, `<slot>`, `$:`, `$$props`/`$$restProps`/`$$slots` are hard compile ERRORS**, but
  `createEventDispatcher` + consumer `on:event` stay deprecation *warnings* (filtered). So the moment
  you change a piece's props to `$props()` you MUST also convert its slots→snippets and `$:`→
  `$derived`/`$effect` — but the event→callback swap is optional. We did swap events→callback props
  (`on:valueupdated`→`on_valueupdated`, `on:itemremoved`→`on_itemremoved({value,index})`, etc.) for a
  clean Svelte-5 surface, updating the (few) component-event consumers.
- **The M2c codemod already converted slot-prop CONSUMERS to `{#snippet children({…})}`** while the
  pieces stayed legacy `<slot {x}>` (interop "runs but type-warns"). So converting a piece to
  `{@render children?.({x})}` *aligns* it with consumers already written for the new API — only
  component-**event** (`on:foo`) consumers need touching. Always grep consumers before converting.
- **`ShowHide` was left legacy on purpose**: it has no `export let`/`$$props`, so it's lint-clean
  (its `<slot>` is only a warning), and it has ~35 consumers. Not worth converting for lint.
- `import-x/no-mutable-exports` fires on Svelte `export let` — a false positive for legacy props; the
  real fix is `$props()`, not disabling the rule.
- **JS file with snippet props**: a snippet prop without `= undefined` is inferred *required* and
  breaks every consumer — default it.

### @migration-task component gotchas
- **A variable literally named `state` breaks the `$state` rune** (svelte-check: "`$state` used before
  declaration" / "untyped call may not accept type arguments" on every `$state<T>()` in the file).
  Rename the variable (`recorder_state`) and pass it under the old name in the render if a consumer
  snippet destructures `state`.
- A `$:` block that **reads and writes the same `$state`** (e.g. `if (recorder) recorder.stopRecording();
  recorder = new …`) becomes an infinite `$effect` loop. Wrap the read in `untrack(() => …)` and assign
  via a local so the written state isn't a tracked dependency.

### Custom-event action in a lang=ts consumer
A JS action that `dispatchEvent`s a custom event needs the event typed so `on<event>` is allowed on the
element. **JSDoc `@type {Action<…, {onfoo?:…}>}` on a `function`/`const` did NOT bind.** Converting
`longpress.js` → `longpress.ts` with `export const longpress: Action<HTMLElement, P, { onlongpress?:
(e: CustomEvent) => void }> = (node, …) => {…}` worked.

### Misc rule fixes worth knowing
- **`@typescript-eslint/ban-types` was removed in TS-ESLint v8** → stale `// eslint-disable … ban-types`
  (and antfu `ts/*` aliases like `ts/method-signature-style`) throw **"Definition for rule '…' was not
  found"** under eslint 10. Replace `Function` with `(...args: any[]) => any` and delete the directive.
- `new Error(msg, { cause })` can exceed the TS lib target ("Expected 0-1 arguments, but got 2") → keep
  single-arg and disable `preserve-caught-error` with a reason (the original is logged anyway).
- `no-useless-assignment` misfires on `$bindable`/`$props` defaults → off in the svelte block.
- **`svelte/require-each-key` conventions** (53 added): DB-row arrays → `(x.id)`; string arrays → `(x)`;
  `Object.entries` → `(key)`; `SelectOption` → `(x.value)`; device lists → `(x.deviceId)`; role rows →
  `(x.user_id)`; fixed-range / id-less / uncertain shapes → index (behavior-identical to the pre-key default).
- Module-level `new Set`/`new Map` registries (not reactive) → `// eslint-disable-next-line
  svelte/prefer-svelte-reactivity` rather than forcing `SvelteSet`/`SvelteMap`.

## Hook
`.githooks/pre-commit` (test → check → lint:fix → re-stage already-staged: `git diff --cached
--name-only --diff-filter=d | xargs -r git add`), wired via `package.json` `prepare`
(`git config core.hooksPath .githooks`). Mirrors house/example.
