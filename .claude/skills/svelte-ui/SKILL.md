---
name: svelte-ui
description: UI design guidelines (UnoCSS, icons, styling) and svelte-look component stories for visual screenshot verification. Read when building or modifying the SvelteKit web app components.
---

# UI Component Development

This skill covers two areas: **UI design/styling** and **svelte-look stories for visual verification**. Applies to `new-site/`.

---

# Part 1: UI Design System

Use minimal, spacious design. Avoid excess borders and heavy colors. Rely on subtle surface color differences, gentle hover effects, and smooth transitions to feel polished without visual noise.

## Core Philosophy

- **Minimal chrome**: Avoid gratuitous borders, dividers, or decoration. Let whitespace do the work.
- **Surface-based hierarchy**: Distinguish elements through subtle background color shifts, not outlines.
- **Generous spacing**: Use `3` (.75rem) padding on cards/containers, `3` (.75rem) between sections, `2` (.5rem) gaps between list items.
- **Physical feel**: Scale buttons down on press (`scale(0.925)`), compress cards slightly on tap (`scale(0.975)`).

## Color Palette

The semantic CSS custom properties live in `new-site/src/lib/theme.css` and resolve to per-mode values via `:root, .light { … }` and `.dark { … }` mappings, plus a `prefers-color-scheme` media query for system-default dark mode. Always use these vars in components — never hardcode colors or sprinkle `dark:` variants.

Current semantic vars: `--primary`, `--on-primary`, `--background`, `--surface`, `--border-color`, `--color`, `--color-secondary`, `--danger`, `--warning`, `--success`.

LD's primary is **Tailwind blue-500** in light, lighter blue in dark.

## Font stack

LD uses a multilingual-aware system font stack (NOT Inter), configured in `new-site/uno.config.ts`'s `theme.font.sans`. The stack intentionally avoids `system-ui` / `-apple-system` / `BlinkMacSystemFont` / `Helvetica Neue` / `ui-sans-serif` because Mac Chrome's `.SF NS` renders diacritics incorrectly. Order: `Segoe UI, Arial, "Noto Sans", "Noto Sans Wancho", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`. Per-dictionary custom fonts (e.g. Sompeng, Wancho) will be loaded on demand in a later phase.

## Use UnoCSS inline classes instead of custom CSS

1. Use color variables defined in the color palette (`var(--background)`, `var(--surface)`, `var(--color)`, etc) instead of hardcoded colors or `dark:` variants. This ensures automatic dark mode support without needing to sprinkle `dark:` prefixes throughout the codebase.

```svelte
<!-- Do this -->
<div class="bg-[var(--surface)] text-[var(--color)]">
  <p class="text-[var(--color-secondary)]">Subtitle</p>
</div>

<!-- Not this -->
<div class="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p class="text-gray-500 dark:text-gray-400">Subtitle</p>
</div>
```

2. **Never build class names programmatically**. UnoCSS scans the template statically — dynamic strings in JS won't be detected.

```svelte
  <!-- ✅ GOOD: Full class strings visible in template -->
  {#if condition}
    <span class="i-mdi-check"></span>
  {:else}
    <span class="i-mdi-close"></span>
  {/if}

<!-- ❌ BAD: UnoCSS won't generate styles for these -->
<script>
  const icon = condition ? 'i-mdi-check' : 'i-mdi-close'
  const color = `text-${status}-500`
</script>
<span class={icon}></span>
<span class={color}></span>
```

3. **Never interpolate partial class names**: `text-${color}-500` won't work. Write out the full class name.

## Icons

Icons are applied via UnoCSS classes. LD uses Iconify via `@iconify/json` (all collections available) with the `i-` prefix.

```svelte
<span class="i-mdi-arrow-left text-lg"></span>
```

### Picking icons

`@iconify/json` is installed, so any Iconify collection works. Prefer the `mdi` (Material Design Icons) collection for consistency unless a different collection has a markedly better icon.

### Icon Sizing

Icons inherit font size. Control with text utility classes:
```svelte
<span class="i-mdi-home text-sm"></span>   <!-- small -->
<span class="i-mdi-home text-lg"></span>   <!-- large -->
<span class="i-mdi-home text-2xl"></span>  <!-- extra large -->
```

## Buttons

Write buttons inline with UnoCSS classes. Three shortcut classes are defined in `uno.config.ts` covering variant styles, pill shape, transitions, and press effect. Add sizing classes per use.

### Three Variants

**`btn`** (surface-colored, default):
```svelte
<button type="button" class="btn btn-default">Label</button>
```

**`btn-outline`:**
```svelte
<button type="button" class="btn-outline btn-default">Label</button>
```

**`btn-ghost`** (transparent, for icon-only toolbar buttons):
```svelte
<button type="button" class="btn-ghost p-2.5">
  <span class="i-mdi-cog text-lg"></span>
</button>
```

### Icon Spacing in Buttons

Since `btn`, `btn-outline`, and `btn-ghost` use `inline-flex`, icons need `mr-1` to add spacing before the label text:

```svelte
<button type="button" class="btn btn-default">
  <span class="i-mdi-plus mr-1"></span> Label
</button>
```

### Sizing

Three size shortcuts are available. For icon-only buttons, use padding directly instead.

- **`btn-sm`**: `px-2.5 py-1.5 text-xs` (icon-only: `p-1.5`)
- **`btn-default`**: `px-3.5 py-2 text-sm font-medium` (icon-only: `p-2.5`)
- **`btn-lg`**: `px-4.5 py-2.5 text-base font-bold` (icon-only: `p-3.5`)

```svelte
<button type="button" class="btn btn-sm">Small</button>
<button type="button" class="btn btn-default">Default</button>
<button type="button" class="btn btn-lg">Large</button>
<button type="button" class="btn-ghost p-2.5"><span class="i-mdi-cog text-lg"></span></button>
```

### When you need async-spinner behavior

Once `HeadlessButton.svelte` is ported (deferred — see house's `.knowledge/ui/svelte-pieces-deferred.md` for the canonical reference), use it for the spinner pattern. For now, write the loading state inline or port the component when first needed.

### Press Effect

The `active:scale-93 active:duration-75` classes create a snappy press that bounces back slowly (75ms press, 300ms release via the base `duration-300`).

### Disabled State
- Set `opacity: 0.75`, color to `--color-secondary`
- Remove scale on press, set cursor to `default`

## Cards / List Items

Style cards as the primary content containers:

```css
.card {
  display: block;
  margin-bottom: 1rem;
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 0.75rem;
  text-decoration: none;
  color: var(--color);
}
```

Follow these rules:
- **No border** — distinguish cards from the page solely by the `--surface` vs `--background` color difference
- **Rounded corners**: Use `0.75rem` — noticeable but not bubbly
- **Press effect**: Apply `scale(0.975)` with `opacity: 0.75` — more subtle than buttons
- **Text clamping**: Apply `-webkit-line-clamp` for preview truncation (e.g., 5 lines)

## Inputs / Textareas

Style textareas to be invisible — they should inherit everything from the page:

```css
textarea {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 1rem;
  font-family: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  color: inherit;
  resize: none;
}
```

The content IS the interface — avoid any input chrome. Style placeholders with `--color-secondary`.

## Reusable design components

Components live in `new-site/src/lib/svelte-pieces/` once ported. As of this writing, only the `Welcome.svelte` smoke component exists. Port from house (`~/code/house/site/src/lib/svelte-pieces/`) which has Tier 1 ready: `Modal`, `Toasts`, `HeadlessButton`, `ShowHide`, `bay/`, plus action helpers (`clickoutside`, `portal`, `trapFocus`, `focus-on-mount`).

---

# Part 2: Svelte-look Component Visual Verification

## Writing Stories

Create `ComponentName.stories.ts` next to your component:

```ts
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ComponentName.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 200, height: 60 }],  // required for regular components either as shared or in each individual story
  page_data: { user_name: 'John' }, // will be shared by all stories in this file
}

export const Primary: Story<typeof Component> = {
  props: {
    label: 'Save',
    variant: 'primary',
  },
}

export const Secondary: Story<typeof Component> = {
  viewports: [{ width: 200, height: 100 }], // overrides viewports defined in shared_meta
  props: {
    label: 'Cancel',
    variant: 'secondary',
  },
  page_data: { user_name: 'Bill' },
}
```

### Page/layout story with Shared Props Pattern

For `+page.svelte` or `+layout.svelte`, name the stories file `_page.stories.ts` or `_layout.stories.ts`. svelte-look will automatically pass props into the `data` prop.

```ts
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {}

export const First: PageStory<typeof Component> = {
  props: {
    items: [],
  },
}
```

## Snippet Props

For components with snippet props (`children`, `title`, etc.), use `createRawSnippet`:

```ts
import { createRawSnippet } from 'svelte'

const children_snippet = createRawSnippet(() => ({
  render: () => '<div class="p-3"><p>Some content</p></div>',
}))

export const Default: Story<typeof Component> = {
  props: {
    children: children_snippet,
  },
}
```

### CSR story with interactions
Use `csr: true` for components that need `onMount`, or browser APIs and have `interactions` to click/type before the screenshot:

```ts
import type { Story } from 'svelte-look'
import type Component from './Counter.svelte'

export const Incremented: Story<typeof Component> = {
  viewports: [{ width: 250, height: 70 }],
  csr: true, 
  interactions: async (page) => {
    const buttons = await page.$$('button')
    await buttons[1].click()
    await buttons[1].click()
  },
}
```

The `interactions` function receives a [Puppeteer Page](https://pptr.dev/api/puppeteer.page) object. Common methods:
- `page.click('button.submit')` — click an element
- `page.type('input[name=email]', 'test@example.com')` — type into an input
- `page.$$('button')` — select all matching elements
- `page.waitForSelector('.loaded')` — wait for an element to appear
- `page.select('select', 'option-value')` — select a dropdown option

### Story types

```ts
interface StoryMeta {
  viewports?: Viewport[]            // required for regular components, optional for pages
  page_data?: Record<string, any>   // merged into SvelteKit page data
  contexts?: MockedContext[]        // Svelte contexts via setContext
  csr?: boolean                     // true = mount in real browser, false = SSR (default)
  interactions?: (page: any) => Promise<void>  // Puppeteer interactions before screenshot
  flavors?: false                   // set to false to opt out of flavor rendering
  dark?: false                      // set to false to opt out of dark mode rendering
}
```

## Shared Mocks File

Project-wide defaults for page data live in `new-site/src/lib/mocks/svelte-look-mocks.ts`:

```ts
import type { Flavor, MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {}

export const default_contexts: MockedContext[] = []

export const flavors: Record<string, Flavor> = {
  default: { page_data: {} },
}
```

Resolution order (later overrides earlier):
1. Mocks file defaults
2. Flavor `page_data` (if using flavors)
3. `shared_meta` in stories file
4. Individual story

## SSR vs CSR — when to use which

| Use SSR (default) | Use CSR (`csr: true`) |
|---|---|
| Props-only rendering | Components with `onMount` or browser only content |
| Fastest screenshots | Need to test interactions (clicks, typing) |
| Most components | Components using browser APIs |

## Screenshot clipping

Screenshots are clipped to the viewport by default. Use `--full-page` on the CLI to capture the full scrollable content.

## Flavors

Flavors let you render every story with different `page_data` variants. New-site currently ships only a `default` flavor; add named flavors when stories need to differ (e.g. per-dictionary or per-locale).
