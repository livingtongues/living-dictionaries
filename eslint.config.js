// To run automatically on commit, add `simple-git-hooks` and `lint-staged` then run `npx simple-git-hooks` once. After that all commits will be linted.

// @ts-check
import { antfu } from '@antfu/eslint-config'
import tsEslintPlugin from '@typescript-eslint/eslint-plugin'
import svelteStylistic from 'eslint-plugin-svelte-stylistic'

// /** @type import('@antfu/eslint-config').TypedFlatConfigItem['rules'] */
// const typescript_overrides =
// {
//   ''
// }

// https://github.com/antfu/eslint-config
// Inspect: npx @eslint/config-inspector
export default antfu(
  {
    ignores: [
      '**/.svelte-kit**',
      '.eslintcache',
      'packages/scripts/import/old**',
      '**/route/kitbook/**',
      '**/locales/**',
      'supabase/functions/**',
      '**.snap.json',
    ],
    stylistic: {
      overrides: {
        'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'antfu/if-newline': 'off',
        'curly': 'off',
      },
    },
    svelte: true,
  },
  {
    name: 'jacob/svelte/stylistic',
    files: ['**/*.svelte', '**/*.composition'],
    plugins: {
      'svelte-stylistic': svelteStylistic,
    },
    rules: {
      'svelte-stylistic/brackets-same-line': 'error',
      'svelte-stylistic/consistent-attribute-lines': 'error',
    },
  },
  {
    name: 'jacob/test/rules',
    files: ['**/*.test.ts'],
    rules: {
      'test/consistent-test-it': ['error', { fn: 'test' }],
      'test/no-disabled-tests': 'error',
      'test/consistent-test-filename': 'error',
      'test/expect-expect': 'error',
      'test/no-alias-methods': 'error',
      'test/no-conditional-expect': 'error',
      'test/no-conditional-in-test': 'error',
      'test/no-conditional-tests': 'error',
      'test/no-duplicate-hooks': 'error',
      'test/no-focused-tests': 'error',
      'test/no-standalone-expect': 'error',
      'test/no-test-return-statement': 'error',
      'test/prefer-comparison-matcher': 'error',
      'test/prefer-hooks-on-top': 'error',
      'test/prefer-spy-on': 'error',
      'test/prefer-to-be-falsy': 'error',
      'test/prefer-to-be-truthy': 'error',
      'test/prefer-to-contain': 'error',
      'test/prefer-to-have-length': 'error',
      'test/valid-describe-callback': 'error',
      'test/valid-expect': 'error',
      'test/no-commented-out-tests': 'warn',
    },
  },
  {
    name: 'jacob/settings',
    files: ['.vscode/*.json'],
    rules: {
      'jsonc/comma-dangle': ['error', 'always-multiline'],
    },
  },
  {
    name: 'ld/script-exceptions',
    files: ['packages/scripts/**'],
    rules: {
      'no-console': 'off',
      'ts/no-unused-vars': 'off',
      'ts/no-var-requires': 'off',
      'node/prefer-global/process': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },
  {
    name: 'ld/intercontinental-dictionaries-series',
    files: ['**/ids-import/**'],
    rules: {
      'ts/no-unused-vars': 'off',
      'no-undef': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },
).overrides({
  'antfu/typescript/rules': {
    files: ['**/*.svelte', '**/*.composition'],
    rules: {
      // ...jsEslintPlugin.configs.recommended.rules,
      'constructor-super': 'error',
      'for-direction': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-constant-condition': 'error',
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-empty-static-block': 'error',
      'no-ex-assign': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-misleading-character-class': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-obj-calls': 'error',
      'no-octal': 'error',
      'no-prototype-builtins': 'error',
      'no-redeclare': 'error',
      'no-regex-spaces': 'error',
      'no-self-assign': 'error',
      'no-setter-return': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-this-before-super': 'error',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-unused-labels': 'error',
      'no-unused-private-class-members': 'error',
      'no-useless-backreference': 'error',
      'no-useless-catch': 'error',
      'no-useless-escape': 'error',
      'no-with': 'error',
      'require-yield': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',

      ...tsEslintPlugin.configs.stylistic.rules,

      'prefer-destructuring': 'error',
      'no-constant-binary-expression': 'error',
      'ts/default-param-last': 'error',
      'require-await': 'error',
      'prefer-object-spread': 'error',
      'no-useless-concat': 'error',
      'no-else-return': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info', 'time', 'timeEnd'] }],
      'require-atomic-updates': 'error',
      'style/quotes': ['error', 'single', {
        allowTemplateLiterals: true,
        avoidEscape: true,
      }],
      'ts/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        // vars: 'all', // is this helpful?
        varsIgnorePattern: '^\\$\\$Props$',
      }],

      'ts/no-explicit-any': 'warn',
      'prefer-named-capture-group': 'warn',
      'eqeqeq': 'warn',

      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-alert': 'off',
      'ts/ban-ts-comment': 'off',
      'ts/sort-type-constituents': 'off', // prefer logical rather than alphabetical sorting
      'curly': 'off',
      'antfu/if-newline': 'off',
      'node/prefer-global/process': 'off',
    },
  },
  'antfu/svelte/rules': {
    files: ['**/*.composition'],
    rules: {
      'svelte/valid-compile': ['error', { ignoreWarnings: true }], // throws error on a11y issues
      'svelte/no-dom-manipulating': 'error',
      'svelte/no-store-async': 'error', // causes issues with auto-unsubscribing features
      'svelte/require-store-reactive-access': 'error',
      'svelte/require-event-dispatcher-types': 'error',
      'svelte/button-has-type': 'error',
      'svelte/no-extra-reactive-curlies': 'error',
      'svelte/mustache-spacing': 'error',
      'svelte/html-closing-bracket-spacing': 'error',
      'svelte/no-reactive-reassign': ['warn', { props: false }],
      'no-unused-vars': 'warn',
      'unused-imports/no-unused-vars': 'warn',

      'svelte/html-quotes': 'off', // should it enforce double quotes?
      'svelte/no-at-html-tags': 'off',
      'no-unused-expressions': 'off',
      'no-inner-declarations': 'off',
      'style/space-infix-ops': 'off',
      'no-undef-init': 'off',
      'no-self-assign': 'off',
      'import/no-self-import': 'off',
    },
  },
})

// learn more
// https://github.com/AndreaPontrandolfo/sheriff
// https://github.com/enso-org/enso/blob/b2c1f97437870fa7b7a4d7c2d3630e2d2bd6fc2c/app/ide-desktop/eslint.config.js
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/base/index.ts
// https://github.com/darkobits/eslint-plugin/blob/f55a64dc9038148f3227cda7ae4543dffcb0b14e/src/config-sets/ts
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/react/index.ts
