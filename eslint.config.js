// To run automatically on commit, add `simple-git-hooks` and `lint-staged` then run `npx simple-git-hooks` once. After that all commits will be linted.

// @ts-check
import { defineFlatConfig } from 'eslint-define-config'
import jsEslintPlugin from '@eslint/js'
import { typescript } from './lint/typescript.js'
import { scriptExceptions } from './lint/allowScriptLogs.js'
import { svelte } from './lint/svelte.js'
import { vitest } from './lint/vitest.js'
import { intercontinentalDictionarySeries } from './lint/ids.js'

const ignore = defineFlatConfig({
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/functions/lib/**',
    '.git/**',
    '**/.svelte-kit**',
    'packages/scripts/import/old**',
    '**/route/kitbook/**',
    '**/locales/**',
    // '**/ids-import/**.ts'
  ],
})

const universal = defineFlatConfig({
  rules: {
    ...jsEslintPlugin.configs.recommended.rules,
    'indent': ['error', 2],
  },
})

// @ts-ignore
export default defineFlatConfig([
  ignore,
  universal,
  typescript,
  svelte,
  vitest,
  scriptExceptions,
  intercontinentalDictionarySeries,
])

// ! You must manually restart ESLint for changes to imported files to take effect in the extension.

// learn more
// https://github.com/AndreaPontrandolfo/sheriff
// https://github.dev/antfu/eslint-config
// https://github.com/enso-org/enso/blob/b2c1f97437870fa7b7a4d7c2d3630e2d2bd6fc2c/app/ide-desktop/eslint.config.js
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/base/index.ts
// https://github.com/darkobits/eslint-plugin/blob/f55a64dc9038148f3227cda7ae4543dffcb0b14e/src/config-sets/ts
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/react/index.ts
