---
name: svelte-look
description: Screenshot Svelte components via CLI or MCP tool. Use to visually verify component rendering, test dark mode variants, and compare flavor presets.
---

# svelte-look — Component Visual Verification

Screenshot Svelte components from the command line. Write a `.stories.ts` file, run the CLI, get a PNG.

## CLI Commands

### Screenshot a component
```bash
npx svelte-look /lib/components/Button                       # all stories
npx svelte-look /lib/components/Button --story Primary        # specific story
npx svelte-look /lib/components/Button --output Button.png    # save to file
npx svelte-look "/routes/(app)/+page" --story Default         # page component (quote parens)
npx svelte-look /lib/components/Button --flavor china         # specific flavor
npx svelte-look /lib/components/Button --all-flavors          # all flavors
```

Output: base64 PNG to stdout (or file with `--output`). When screenshotting multiple variants with `--output`, files are named `Button_Primary_world.png`, `Button_Primary_world_dark.png`, etc.

### List components
```bash
npx svelte-look list
```

## Writing Stories

Create a `ComponentName.stories.ts` file next to the component:

### Regular component story
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

For components with snippet props (`children`, `title`, etc.), use `createRawSnippet`:

```typescript
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
  flavors?: false                   // opt out of flavor variants
  dark?: false                      // opt out of dark mode variants
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

## Project Config

Create `svelte-look.config.ts` in the project root:

```ts
import { define_config } from 'svelte-look'

export default define_config({
  // Universal CSS files included in SSR screenshots (relative to project root)
  css_files: ['src/lib/theme.css'],

  // Path to shared mocks file (optional)
  mocks: 'src/lib/mocks/svelte-look-mocks.ts',

  // Default viewports for +page.svelte and +layout.svelte only
  // Regular components must define viewports in their .stories.ts
  page_viewports: [{ width: 400, height: 700 }],
  dark_mode: true,  // render light + dark variants as separate images
})
```

## Shared Mocks File

Project-wide defaults for page data (accessed via prop in page and layout components and using `import { page } from '$app/state'` and `page.data` elsewhere), contexts, and flavors:

```ts
import type { Flavor, MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {
  foo: 'baz',
}

export const default_contexts: MockedContext[] = [
  { key: 'portal', value: { content: {} } },
]

// these will be merged with page_data based on which flavor is being screenshotted
export const flavors: Record<string, Flavor> = {
  world: {
    page_data: {
      mother: 'en',
      learning: 'zh',
    },
  },
  china: {
    page_data: {
      mother: 'zh',
      learning: 'en',
    },
  },
}
```

Resolution order (later overrides earlier with a shallow merge):
1. `default_page_data` from mocks file
2. `flavor.page_data` (if flavors exist)
3. `shared_meta.page_data` in stories file
4. Individual story `page_data`

## Flavors

Named sets of `page_data` overrides from the mocks file.

- Auto-inferred from the `flavors` export — no config needed
- **First flavor used by default** when flavors exist
- `--flavor <name>` for a specific flavor, `--all-flavors` to render all
- Opt out per story with `flavors: false` on `shared_meta` or the individual story

## Dark Mode

When `dark_mode: true` in config:

- Every story renders **both light and dark as separate images**
- SSR: `class="dark"` on `<html>` + `prefers-color-scheme` media emulation
- CSR: same plus `classList.add('dark')` on `documentElement`
- Body uses `background: var(--background, #ffffff); color: var(--color, #000000)` — override via CSS custom properties in your theme
- Opt out per story with `dark: false` on `shared_meta` or the individual story
- Output filenames: `Component_Story.png` and `Component_Story_dark.png`
- Base64 stdout: separate newline-delimited chunks (MCP tool returns each as a separate image)

## SSR vs CSR — when to use which

| Use SSR (default) | Use CSR (`csr: true`) |
|---|---|
| Props-only rendering | Components with `onMount` or browser only content |
| Fastest screenshots | Need to test interactions (clicks, typing) |
| Most components | Components using browser APIs |
