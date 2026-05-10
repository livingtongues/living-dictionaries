// @ts-check
// Living Dictionaries ESLint config — hand-written (no @antfu/eslint-config) for clarity.
// SCOPE: only `new-site/` is linted. The legacy production app at `packages/site/` and
// other workspace packages are deliberately ignored — they're being phased out as
// `new-site` rebuilds the platform (mirrors the house repo's `site/` migration).
//
// Naming: canonical plugin namespaces (e.g. `@typescript-eslint/*`, `@stylistic/*`,
// `import-x/*`). When a rule fails, the rule id in the error matches a key in this file
// — no aliasing layer to debug through.
//
// Inspect what's effectively active for any file:
//   pnpm lint:inspect       (interactive)
//   npx eslint --print-config <path>
// See ~/code/house/.knowledge/tooling/eslint-config.md for the full debugging workflow.

import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importX from 'eslint-plugin-import-x'
import jsonc from 'eslint-plugin-jsonc'
import nodePlugin from 'eslint-plugin-n'
import perfectionist from 'eslint-plugin-perfectionist'
import regexp from 'eslint-plugin-regexp'
import svelte from 'eslint-plugin-svelte'
import svelteStylistic from 'eslint-plugin-svelte-stylistic'
import unicorn from 'eslint-plugin-unicorn'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import vitestPlugin from '@vitest/eslint-plugin'

export default tseslint.config(
  // ─────────────────────────────────────────────────────────────
  // 1. Ignores — everything except new-site/
  // ─────────────────────────────────────────────────────────────
  {
    ignores: [
      '**/.svelte-kit/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.eslintcache',
      '**/*.md',
      '**/.claude/**',
      '**/.opencode/**',
      '.knowledge/**',
      '.issues/**',

      // Legacy / out-of-scope packages
      'packages/**',
      'supabase/**',
      'e2e/**',

      // Root-level non-source
      'FLEx.model.ts',
      'architecture-diagram.svg',
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. JS recommended (most of the 106 core rules)
  // ─────────────────────────────────────────────────────────────
  js.configs.recommended,

  // ─────────────────────────────────────────────────────────────
  // 3. typescript-eslint recommended + stylistic presets
  // ─────────────────────────────────────────────────────────────
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // ─────────────────────────────────────────────────────────────
  // 4. Plugin registration (canonical names)
  // ─────────────────────────────────────────────────────────────
  {
    plugins: {
      '@stylistic': stylistic,
      'import-x': importX,
      'n': nodePlugin,
      perfectionist,
      regexp,
      unicorn,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 5. Stylistic recommended — antfu-aligned (no JSX, no semi, single quotes)
  // ─────────────────────────────────────────────────────────────
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    jsx: false,
    arrowParens: false,
    braceStyle: '1tbs',
    blockSpacing: true,
    quoteProps: 'consistent-as-needed',
    commaDangle: 'always-multiline',
  }),

  // ─────────────────────────────────────────────────────────────
  // 6. Core JS rules — extras beyond eslint-recommended
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/core',
    rules: {
      'accessor-pairs': 'error',
      'array-callback-return': 'error',
      'block-scoped-var': 'error',
      'default-case-last': 'error',
      'dot-notation': 'error',
      'eqeqeq': 'warn',
      'no-caller': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'time', 'timeEnd'] }],
      'no-constant-binary-expression': 'error',
      'no-else-return': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-empty-static-block': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-implied-eval': 'error',
      'no-iterator': 'error',
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-proto': 'error',
      'no-restricted-globals': 'error',
      'no-restricted-imports': 'error',
      'no-restricted-properties': 'error',
      'no-restricted-syntax': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-concat': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'prefer-arrow-callback': 'error',
      'prefer-destructuring': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-named-capture-group': 'warn',
      'prefer-object-spread': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'require-atomic-updates': 'warn',
      'require-await': 'error',
      'symbol-description': 'error',
      'vars-on-top': 'error',
      'yoda': 'error',

      'curly': 'off',
      'no-alert': 'off',
      'no-undef': 'off', // TS handles this
      'no-unused-vars': 'off', // delegated to @typescript-eslint/no-unused-vars
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 7. TypeScript rule overrides
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/typescript-eslint',
    rules: {
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/method-signature-style': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',

      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/sort-type-constituents': 'off',

      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^\\$\\$Props$',
      }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 8. Stylistic overrides
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/stylistic-overrides',
    rules: {
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/max-statements-per-line': 'off',
      '@stylistic/quotes': ['error', 'single', {
        allowTemplateLiterals: 'always',
        avoidEscape: true,
      }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 9. Regexp recommended — antfu's curated 56-rule set
  // ─────────────────────────────────────────────────────────────
  regexp.configs['flat/recommended'],

  // ─────────────────────────────────────────────────────────────
  // 10. Unicorn rules — antfu's curated 15
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/unicorn',
    rules: {
      'unicorn/consistent-empty-array-spread': 'error',
      'unicorn/error-message': 'error',
      'unicorn/escape-case': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-new-array': 'error',
      'unicorn/no-new-buffer': 'error',
      'unicorn/number-literal-case': 'error',
      'unicorn/prefer-dom-node-text-content': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-type-error': 'error',
      'unicorn/throw-new-error': 'error',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 11. Node rules — antfu's 6
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/node',
    rules: {
      'n/handle-callback-err': ['error', '^(err|error)$'],
      'n/no-deprecated-api': 'error',
      'n/no-exports-assign': 'error',
      'n/no-new-require': 'error',
      'n/no-path-concat': 'error',
      'n/process-exit-as-throw': 'error',
      'n/prefer-global/buffer': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 12. Import rules — antfu's 6 (eslint-plugin-import-x is the actively maintained fork)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/import',
    rules: {
      'import-x/consistent-type-specifier-style': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-named-default': 'error',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 13. Perfectionist — antfu's 2 (just sort named imports/exports)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/perfectionist',
    rules: {
      'perfectionist/sort-named-exports': ['error', { type: 'natural' }],
      'perfectionist/sort-named-imports': ['error', { type: 'natural' }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 14. Svelte — eslint-plugin-svelte recommended + LD overrides
  //     Two Svelte-5-specific `off`s tutor/house don't yet need:
  //     - `no-use-before-define` ($derived can forward-reference)
  //     - `no-unused-expressions` ($effect tracks deps via bare reads)
  // ─────────────────────────────────────────────────────────────
  ...svelte.configs.recommended,
  {
    name: 'ld/svelte-global-off',
    // LD's new-site is at livingdictionaries.app (apex). No `paths.base` to worry about.
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    name: 'ld/svelte',
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
    plugins: {
      'svelte-stylistic': svelteStylistic,
    },
    rules: {
      'svelte/valid-compile': ['error', { ignoreWarnings: true }],
      'svelte/no-dom-manipulating': 'error',
      'svelte/no-store-async': 'error',
      'svelte/require-store-reactive-access': 'error',
      'svelte/require-event-dispatcher-types': 'error',
      'svelte/button-has-type': 'error',
      'svelte/no-extra-reactive-curlies': 'error',
      'svelte/mustache-spacing': 'error',
      'svelte/html-closing-bracket-spacing': 'error',
      'svelte/no-reactive-reassign': ['warn', { props: false }],

      'svelte-stylistic/brackets-same-line': 'error',
      'svelte-stylistic/consistent-attribute-lines': 'error',

      // Off in svelte files (rules that misfire on parsed svelte AST or Svelte 5 idioms)
      'svelte/html-quotes': 'off',
      'svelte/no-at-html-tags': 'off',
      'no-inner-declarations': 'off',
      'no-self-assign': 'off',
      'no-undef-init': 'off',
      'no-unused-expressions': 'off',
      'no-unused-vars': 'warn',
      'prefer-const': 'off',
      'import-x/no-self-import': 'off',
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/space-infix-ops': 'off',

      // Svelte 5 specific
      '@typescript-eslint/no-use-before-define': 'off', // $derived can reference forward
      '@typescript-eslint/no-unused-expressions': 'off', // $effect tracks deps via bare reads
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 15. Vitest test rules
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/test',
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    plugins: { vitest: vitestPlugin },
    rules: {
      'vitest/consistent-test-it': ['error', { fn: 'test', withinDescribe: 'test' }],
      'vitest/no-disabled-tests': 'error',
      'vitest/consistent-test-filename': 'error',
      'vitest/expect-expect': 'error',
      'vitest/no-alias-methods': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-conditional-in-test': 'error',
      'vitest/no-conditional-tests': 'error',
      'vitest/no-duplicate-hooks': 'error',
      'vitest/no-focused-tests': ['error', { fixable: false }],
      'vitest/no-standalone-expect': 'error',
      'vitest/no-test-return-statement': 'error',
      'vitest/prefer-comparison-matcher': 'error',
      'vitest/prefer-hooks-on-top': 'error',
      'vitest/prefer-spy-on': 'error',
      'vitest/prefer-to-be-falsy': 'error',
      'vitest/prefer-to-be-truthy': 'error',
      'vitest/prefer-to-contain': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/valid-describe-callback': 'error',
      'vitest/valid-expect': 'error',
      'vitest/no-commented-out-tests': 'warn',

      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.property.name=/^(toBeGreaterThan|toBeGreaterThanOrEqual|toBeLessThan|toBeLessThanOrEqual)$/]',
        message: 'Prefer precise matchers (toBe / toEqual / toHaveLength). Comparison matchers hide off-by-one bugs and produce unhelpful failure messages. Use `// eslint-disable-next-line no-restricted-syntax` only for genuine range checks (timestamps, non-deterministic counts).',
      }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 16. Stories rules
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/stories',
    files: ['**/*.stories.ts', '**/*.stories.js'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      'require-await': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 17. CommonJS shim files
  // ─────────────────────────────────────────────────────────────
  {
    name: 'ld/cjs',
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 18. JSON config rules
  // ─────────────────────────────────────────────────────────────
  ...jsonc.configs['flat/recommended-with-jsonc'],
  {
    name: 'ld/jsonc-vscode',
    files: ['.vscode/*.json'],
    rules: {
      'jsonc/comma-dangle': ['error', 'always-multiline'],
    },
  },
)
