// @ts-check

// @ts-expect-error
import typescriptParser from '@typescript-eslint/parser'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import svelteStylistic from 'eslint-plugin-svelte-stylistic'

/**
 * @type {import('eslint-define-config').FlatESLintConfigItem}
 */
export const svelte = {
  files: ['**/*.svelte', '**/*.composition'],
  plugins: {
    /** @type {any} */
    svelte: sveltePlugin,
    'svelte-stylistic': svelteStylistic,
  },
  languageOptions: {
    parser: svelteParser,
    parserOptions: {
      parser: typescriptParser,
    },
    globals: {
      '$$Generic': 'readonly',
    },
  },
  // @ts-ignore
  rules: {
    'svelte-stylistic/brackets-same-line': 'error',
    'svelte-stylistic/consistent-attribute-lines': 'error',

    ...sveltePlugin.configs.base.overrides[0].rules,
    ...sveltePlugin.configs.recommended?.rules,
    'svelte/valid-compile': ['error', { 'ignoreWarnings': true }], // throws error on a11y issues
    'svelte/no-dom-manipulating': 'error',
    'svelte/html-quotes': 'error',
    'svelte/no-store-async': 'error',
    'svelte/require-store-reactive-access': 'error',
    'svelte/mustache-spacing': 'error',
    'svelte/button-has-type': 'error',
    'svelte/html-closing-bracket-spacing': 'error',
    'svelte/no-extra-reactive-curlies': 'error',

    // turn into errors later
    'svelte/no-reactive-reassign': ['warn', { 'props': false }],
    'svelte/require-event-dispatcher-types': 'warn',
    'svelte/indent': 'warn',
    'indent': 'off', // use svelte/indent instead
    'prefer-destructuring': 'warn',
    'svelte/no-at-html-tags': ['warn'], // will require figuring out how to disable in svelte

    'no-unused-expressions': 'off',
  },
}
