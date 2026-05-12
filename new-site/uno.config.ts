import { defineConfig, presetIcons, presetWind4 } from 'unocss'

// LD intentionally avoids system-ui / -apple-system / BlinkMacSystemFont / Helvetica Neue / ui-sans-serif.
// Reason: Mac Chrome's system font (.SF NS) renders diacritics incorrectly — stacks them vertically on
// top of dotted-i etc. instead of replacing the dot. Stack ported verbatim from old LD global.css
// (see /old/packages/site/src/routes/global.css for the original comments).
const ld_font_stack = [
  '"Segoe UI"',
  'Arial',
  '"Noto Sans"',
  '"Noto Sans Wancho"',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  '"Noto Color Emoji"',
].join(', ')

export default defineConfig({
  shortcuts: [
    {
      'btn': 'inline-flex items-center justify-center rounded-full border text-[var(--color)] transition-all duration-300 active:scale-93 active:duration-75 bg-[var(--surface)] border-transparent hover:bg-[color-mix(in_srgb,var(--surface),var(--color)_4%)]',
      'btn-outline': 'inline-flex items-center justify-center rounded-full border text-[var(--color)] transition-all duration-300 active:scale-93 active:duration-75 bg-[var(--background)] border-[var(--border-color)] hover:bg-[color-mix(in_srgb,var(--background),var(--color)_4%)]',
      'btn-ghost': 'inline-flex items-center justify-center rounded-full border text-[var(--color)] transition-all duration-300 active:scale-93 active:duration-75 bg-transparent border-transparent hover:bg-[color-mix(in_srgb,transparent,var(--color)_4%)]',
      'btn-sm': 'px-2.5 py-1.5 text-xs',
      'btn-default': 'px-3.5 py-2 text-sm font-medium',
      'btn-lg': 'px-4.5 py-2.5 text-base font-bold',
      'view': 'max-w-7xl mx-auto px-4',
    },
  ],
  presets: [
    presetWind4({
      preflights: { reset: true },
    }),
    presetIcons({
      prefix: 'i-',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': '0px',
      },
    }),
  ],
  theme: {
    font: {
      sans: ld_font_stack,
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
  },
})
