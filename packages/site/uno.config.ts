// Regardless of whether config is placed here or inlined in svelte.config.js, the unocss.config.ts file required to make the UnoCSS VSCode extension work (v.0.45.26)
import { defineConfig, presetIcons, presetTypography, presetUno } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'

export default defineConfig({
  presets: [
    presetUno(),
    presetForms(),
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  theme: {
    screens: {
      print: { raw: 'print' },
    },
  },
  shortcuts: [
    { 'form-input': 'border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50' },
  ],
})