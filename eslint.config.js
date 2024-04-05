// To run automatically on commit, add `simple-git-hooks` and `lint-staged` then run `npx simple-git-hooks` once. After that all commits will be linted.

// @ts-check
import { antfu, stylistic, svelte, typescript } from '@antfu/eslint-config'
import jsEslintPlugin from '@eslint/js'
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
      '**/functions/lib/**',
      '.eslintcache',
      'packages/scripts/import/old**',
      '**/route/kitbook/**',
      '**/locales/**',
      'supabase/functions/**',
    ],
  },
  stylistic({
    overrides: {
      'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
  }),
  typescript({
    // files: ['**/*.ts', '**/*.js', '**/*.svelte', '**/*.composition'],
    componentExts: ['svelte', 'composition'],
    overrides: {
      // Need to check if duplicates in these
      ...jsEslintPlugin.configs.recommended.rules,
      // ...tsEslintPlugin.configs.recommended.rules, // cause the rest to break
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

      'no-undef': 'off',
      'no-unused-vars': 'off',
      'curly': 'off',
      'no-alert': 'off',
      'antfu/if-newline': 'off',
      'ts/ban-ts-comment': 'off',
      'ts/sort-type-constituents': 'off', // prefer logical rather than alphabetical sorting
    },
  }),
  svelte({
    files: ['**/*.svelte', '**/*.composition'],
    typescript: true,
    overrides: {
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

      'svelte/html-quotes': 'off', // should it enforce double quotes?
      'svelte/no-at-html-tags': 'off',
      'no-unused-expressions': 'off',
      'no-inner-declarations': 'off',
      'style/space-infix-ops': 'off',
      'no-undef-init': 'off',
      'no-self-assign': 'off',
    },
    // what to do with languageOptions.globals.$$Generic: 'readonly'? - may not be needed with Svelte 5's move away from this
  }),
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
    files: ['**/*.test.ts'],
    rules: {
      'test/consistent-test-it': ['error', { fn: 'test' }],
      'test/no-commented-out-tests': 'error',
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
    },
  },
  {
    name: 'ld/script-exceptions',
    files: ['packages/{scripts,functions}/**'],
    rules: {
      'no-console': 'off',
      'ts/no-unused-vars': 'off',
      'ts/no-var-requires': 'off',
    },
  },
  {
    name: 'ld/intercontinental-dictionaries-series',
    files: ['**/ids-import/**'],
    rules: {
      'ts/no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
)

// learn more
// https://github.com/AndreaPontrandolfo/sheriff
// https://github.com/enso-org/enso/blob/b2c1f97437870fa7b7a4d7c2d3630e2d2bd6fc2c/app/ide-desktop/eslint.config.js
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/base/index.ts
// https://github.com/darkobits/eslint-plugin/blob/f55a64dc9038148f3227cda7ae4543dffcb0b14e/src/config-sets/ts
// https://github.com/azat-io/eslint-config/blob/044959d8fef2acff50e252b8a238be933cd38eea/react/index.ts
