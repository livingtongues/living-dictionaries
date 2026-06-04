import { defineConfig, presetIcons, presetTypography, presetUno } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import extractorSvelte from '@unocss/extractor-svelte'
import transformerDirectives from '@unocss/transformer-directives'

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
  // `@unocss/svelte-scoped` bundled these; the universal `unocss/vite` plugin needs them explicit:
  // extractorSvelte → understands Svelte `class:utility={cond}` directives
  // transformerDirectives → processes `@apply` / `--at-apply` inside <style> blocks
  extractors: [extractorSvelte()],
  transformers: [transformerDirectives()],
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
