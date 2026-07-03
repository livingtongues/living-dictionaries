---
name: svelte-ui
description: UI design guidelines (CSS, icons, theme) and svelte-look component stories for visual screenshot verification. Read when building or modifying the SvelteKit web app components.
---

# UI Component Development

This skill covers two areas: **UI design/styling** and **svelte-look stories for visual verification**.

The whole site uses this design system — everything is scoped CSS + the global theme layer. When making requested UI edits follow these guidelines. SSR screenshots see all styles — `csr: true` is only needed for `onMount`/browser-API components or interactions.

# Part 1: UI Design System

Use minimal, spacious design. Avoid excess borders and heavy colors. Rely on subtle surface color differences, gentle hover effects, and smooth transitions to feel polished without visual noise.

## Core Philosophy

- **Minimal chrome**: Avoid gratuitous borders, dividers, or decoration. Let whitespace do the work.
- **Surface-based hierarchy**: Distinguish elements through subtle background color shifts, not outlines.
- **Generous spacing**: `0.75rem` padding on cards/containers, `0.75rem` between sections, `0.5rem` gaps between list items.
- **Physical feel**: Scale buttons down on press (`scale(0.93)` — already built into `buttons.css`), compress cards slightly on tap (`scale(0.975)`).

## Styling approach: inline styles vs scoped classes

Strike a balance between inline `style="..."` and scoped `<style>` classes. Don't reflexively create a class for everything.

**Prefer inline `style="..."`** when the styling is simple, a handful of static properties on a single element where a class name would add indirection without adding meaning:

```svelte
<div style="display: flex; align-items: center; gap: 0.5rem">
  <IconMdiAccount style="color: var(--color-secondary)" />
  <span>{user.name}</span>
</div>
```

**Use a scoped `<style>` class** when any of these are true:
- **CSS language requires it** (Pseudo-classes, media queries, animations, children styling, etc)
- **Semantic naming helps**: a meaningful name (`.swatch`, `.toolbar`, `.welcome-card`) makes the markup more readable than a long inline string.
- **A lot going on**: many properties, or the same styles repeated across several elements.

## Dynamic styling

**Conditional classes** — Svelte 5 array syntax or `class:` directive, both fine:

```svelte
<div class={['card', { active: is_selected }]}>…</div>
<button class:open={is_open}>…</button>
```

**Dynamic values** — pass computed values down as custom properties:

```svelte
<div style:--accent={accent_color}>…</div>
```

## Color Palette

The semantic CSS custom properties live in `site/src/lib/theme.css` and resolve to per-mode values via `:root, .light { … }` and `.dark { … }` mappings, plus a `@media (prefers-color-scheme: dark)` query for system-default automatic dark mode. Always use these vars in components — never hardcode colors or sprinkle `dark:` variants.

Current semantic vars: `--primary`, `--on-primary`, `--background`, `--surface`, `--border-color`, `--color`, `--color-secondary`, `--danger`, `--warning`, `--success`, `--transition-time`, `--font-sans`, `--font-mono`. 

Living Dictionary's primary is **Tailwind blue-500** in light, lighter blue in dark.

```svelte
<!-- Do this -->
<div style="background: var(--surface); color: var(--color)">
  <p style="color: var(--color-secondary)">Subtitle</p>
</div>

<!-- Not this -->
<div style="background: #f5f5f5; color: #111">
  <p style="color: #888">Subtitle</p>
</div>
```

## Icons

Icons use [`unplugin-icons`](https://github.com/unplugin/unplugin-icons) backed by `@iconify/json` (all collections available). Import the icon as a Svelte component, render it as an element.

```svelte
<script lang="ts">
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
</script>

<IconMdiArrowLeft />
```

### Picking icons

Any Iconify collection works. Prefer the `mdi` (Material Design Icons) collection for consistency unless a different collection has a markedly better icon.

### Styling icons

Icon components accept `class` and `style` like any Svelte component. They render an `<svg>` whose default color is `currentColor` (so they inherit text color by default).

**Prefer inline `style="..."` on the icon** for one-off sizing / color / spacing / vertical-align — keep the styling next to the icon in markup rather than buried in a `<style>` block:

```svelte
<IconMdiClose style="font-size: 1.5rem" />
<IconMdiAlertCircle style="color: var(--danger)" />
```

Size is controlled via `font-size` (icons are `1em` square). For spacing next to a label, an inline `margin` or a `gap` on the flex parent both work.

## Buttons

Global button classes live in `site/src/lib/buttons.css` (imported in `+layout.svelte`, and listed in `svelte-look.config.ts:css_files` so they apply in stories). Keep these class names verbatim in markup — they're not generated, they're real global CSS. Combine one **variant** class with one **size** class.

### Variants

- **`btn`** — surface-colored, the default neutral button
- **`btn-outline`** — transparent-ish with a border
- **`btn-ghost`** — fully transparent, for icon-only toolbar buttons
- **`btn-primary`** — filled with `--primary` / `--on-primary` (call-to-action)

All variants are `inline-flex` (centered) with pill shape (`border-radius: 9999px`), a `300ms` transition, a hover tint via `color-mix`, and a built-in press effect (`:active { transform: scale(0.93); transition-duration: 75ms }`). You do NOT need to add the press/scale yourself.

```svelte
<button type="button" class="btn btn-default">Label</button>
<button type="button" class="btn-outline btn-default">Outline</button>
<button type="button" class="btn-primary btn-lg">Call to action</button>
<button type="button" class="btn-ghost" style="padding: 0.625rem"><IconMdiCog /></button>
```

### Sizes

- **`btn-sm`**: `padding: 0.375rem 0.625rem; font-size: 0.75rem`
- **`btn-default`**: `padding: 0.5rem 0.875rem; font-size: 0.875rem; font-weight: 500`
- **`btn-lg`**: `padding: 0.625rem 1.125rem; font-size: 1rem; font-weight: 700`

For icon-only buttons, skip the size class and apply padding inline (e.g. `style="padding: 0.625rem"`).

### Icon + label spacing

The button classes are `inline-flex` but set **no gap**. For an icon next to a label, add the gap inline (or a margin on the icon):

```svelte
<button type="button" class="btn btn-default" style="gap: 0.5rem">
  <IconMdiPlus /> Add entry
</button>
```

### When you need async-spinner behavior

Use `$lib/svelte-pieces/HeadlessButton.svelte` (ported from tutor): it runs `onclick` async with a built-in `loading` spinner and no styling of its own — compose `btn-*` classes via its `class` prop. The legacy `$lib/svelte-pieces/ui/Button.svelte` (own `form`/`size`/`color` styling) still has many call sites but is being migrated away.

### Other globals in `buttons.css`

`buttons.css` also ships the global `animate-spin` keyframe class (used by the admin loading spinners) and the disabled rule below.

### Disabled State

A global `:disabled, .disabled` rule in `buttons.css` sets `opacity: 0.5; cursor: not-allowed`. Mark any button/input `disabled` (or add the `.disabled` class to a non-form element) and it picks up the same visuals automatically.

## Cards / List Items

Style cards as the primary content containers via a scoped class (semantic name, hover/press states justify the class):

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

Rules:
- **No border** — distinguish cards from the page solely by the `--surface` vs `--background` color difference.
- **Rounded corners**: `0.75rem` — noticeable but not bubbly.
- **Press effect**: `scale(0.975)` with `opacity: 0.75` — more subtle than buttons.
- **Text clamping**: `-webkit-line-clamp` for preview truncation (e.g., 5 lines).

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

The content IS the interface — avoid input chrome. Style placeholders with `--color-secondary` via `::placeholder`.

## Reusable design components

These can be found in `site/src/lib/svelte-pieces` and should be used instead of building new ones where possible. What LD actually ships today (more — bay/ snippet portals — live in tutor and can be ported when needed):
- `HeadlessButton.svelte` — async onclick + loading spinner, unstyled (compose `.btn-*`)
- `Modal.svelte` — escape-to-close, focus-trap, backdrop-click, portal-mounted
- `Toasts.svelte` + `toast.svelte.ts`
- `ShowHide.svelte` — render-prop helper with `{ show, toggle, set }`
- `Slideover.svelte` — side panel (portal-mounted, focus-trap, fade+fly transitions, optional title snippet)
- `RichTextEditor.svelte`, `CopyButton.svelte`, `persisted-state.svelte.ts`
- Actions: `actions/clickoutside`, `actions/longpress`, `actions/portal`, `trapFocus.ts`
- Legacy `ui/` (vendored sp-\* compiled styles — prefer the root pieces above; modernization is logged in `.issues/ui-skill-alignment.md`): `Button.svelte` (async spinner), `Modal.svelte`, `Badge.svelte`, `ResponsiveTable.svelte`, `ResponsiveSlideover.svelte`, `Slideover.svelte`

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

export const shared_meta: StoryMeta = {}  // can optionally override page_viewports set in `svelte-look.config.ts`

const shared_props = {
  user: { name: 'Alice' },
} satisfies Partial<PageStory<typeof Component>['props']> // For stories sharing common props, you can use an object to spread

export const First: PageStory<typeof Component> = {
  props: {
    ...shared_props,
    items: [],
  },
}

export const Another: PageStory<typeof Component> = {
  props: {
    ...shared_props,
    items: [{ id: 1, title: 'Hello' }],
  },
}
```

## Snippet Props

For components with snippet props (`children`, `title`, etc.), use `createRawSnippet`. **Give snippets real content**

```ts
import { createRawSnippet } from 'svelte'

const children_snippet = createRawSnippet(() => ({
  render: () => '<div style="padding: 0.75rem"><p>Some content</p></div>',
}))

export const Default: Story<typeof Component> = {
  props: {
    children: children_snippet,
  },
}
```

### CSR story with interactions

Use `csr: true` for components that need `onMount` or browser APIs, and add `interactions` to click/type before the screenshot:

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

interface Viewport {
  width: number
  height: number
}

interface MockedContext {
  key: any
  value: any
}

interface Story<TComponent extends Component<any>> extends StoryMeta {
  props?: ComponentProps<TComponent>
}

interface PageStory<TComponent extends Component<any>> extends StoryMeta {
  props?: ComponentProps<TComponent>['data']
}
```

## Shared Mocks File

Project-wide defaults for page data, contexts, and flavors can live in a `svelte-look-mocks.ts` file (LD doesn't ship one yet — create it at `site/src/lib/mocks/svelte-look-mocks.ts` if stories start needing shared defaults). Example shape:

```ts
import type { Flavor, MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {}

export const default_contexts: MockedContext[] = []

// these will be shallow merged with page_data based on which flavor is being screenshotted
export const flavors: Record<string, Flavor> = {
  default: { page_data: {} },          // logged-out / public visitor
  signed_in: { page_data: {} },        // logged-in non-admin customer
  signed_in_admin: { page_data: {} },  // logged-in admin
}
```

Resolution order (later overrides earlier):
1. Mocks file defaults
2. Flavor `page_data` (if using flavors)
3. `shared_meta` in stories file
4. Individual story

## SSR vs CSR — when to use which

- Use SSR (default) for Fastest screenshots
- Use CSR (`csr: true`) for components with `onMount` or browser-only content or you need to test interactions (clicks, typing)

## Screenshot clipping

Screenshots are clipped to the viewport by default. Use `--full-page` on the CLI to capture the full scrollable content. **Match the viewport width to the breakpoint you want to verify** — a 480px-wide story shows the mobile layout even if you meant to check the `@media (min-width: 640px)` styles. Page stories default to the `page_viewports` set in `svelte-look.config.ts` (LD uses `480×720`).

## Flavors

Flavors let you render every story with different `page_data` variants. The flavor's `page_data` is shallow-merged on top of the layout-level `page_data` before story-level and shared_meta merges happen. LD has no flavors configured yet (house ships nine auth/subscription flavors — `logged_out`, `customer`, `trialing`, `subscriber`, `canceling`, `editor`, `contributor`, `admin`, `admin_previewing_visitor` — as a reference if we add them). A component with 2 stories will have N images: 2 stories × N flavors × themes (LD renders light AND dark — `dark_mode: true` since the 2026-07-02 dark flip; always eyeball both).
