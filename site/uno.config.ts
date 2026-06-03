import { type Extractor, defineConfig, presetIcons, presetTypography, presetUno, transformerDirectives } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'

// The universal `unocss/vite` plugin's default extractor doesn't understand Svelte's
// `class:utility={condition}` directive syntax (the old `@unocss/svelte-scoped` plugin did),
// so utilities only ever applied that way (e.g. `class:text-4xl`) never get generated.
// This extractor pulls the utility name out of every `class:` directive. The built-in default
// extractor still runs (core re-adds it), so plain `class="..."` extraction is unaffected.
const svelte_class_directive_extractor: Extractor = {
  name: 'svelte-class-directive',
  extract({ code }) {
    const tokens = new Set<string>()
    const matches = code.matchAll(/\bclass:([\w!:./[\]%-]+)/g)
    for (const match of matches)
      tokens.add(match[1])
    return tokens
  },
}

export default defineConfig({
  presets: [
    presetUno(),
    presetForms(),
    presetTypography({
      selectorName: 'tw-prose',
    }),
    presetIcons({
      prefix: 'i-',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  // `@unocss/svelte-scoped` ran the directives transformer by default so that `--at-apply`
  // (and `@apply`) inside component `<style>` blocks worked; the universal plugin needs it added.
  transformers: [
    transformerDirectives(),
  ],
  extractors: [
    svelte_class_directive_extractor,
  ],
  theme: {
    screens: {
      print: { raw: 'print' },
    },
  },
  shortcuts: [
    {
      'form-input': 'border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50',
    },
  ],
  safelist: ['tw-prose'],
})
