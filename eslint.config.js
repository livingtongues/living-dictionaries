// @ts-check
import jsEslintPlugin from '@eslint/js';
import { defineFlatConfig } from 'eslint-define-config';
// @ts-ignore
import typescriptParser from '@typescript-eslint/parser';
import tsEslint from '@typescript-eslint/eslint-plugin'
import globals from 'globals'

/**
 * @type {import('eslint-define-config').FlatESLintConfigItem}
 */const allowScriptLogs = {
  files: ['packages/{scripts,functions}/**',],
  rules: {
    'no-console': 'off',
  },
}

export default defineFlatConfig([
  {
    // If used without any other keys in the configuration object, then the patterns act as global ignores.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '.git/**',
      '**/.svelte-kit/**',
      // pnpm-lock.yaml
      'packages/scripts/import/old**',
    ],
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      }
    }
  },
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      '@typescript-eslint': tsEslint,
    },
    languageOptions: {
      parser: typescriptParser,
      // parserOptions: {
      //   tsconfigRootDir: process.cwd(),
      //   project: true,
      // },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        ...globals.worker,
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
      },
    },
    linterOptions: {
      // reportUnusedDisableDirectives: true
    },
    rules: {
      ...jsEslintPlugin.configs?.recommended?.rules, // new way to do 'eslint:recommended'
      ...tsEslint.configs.recommended?.rules,
      ...tsEslint.configs.stylistic?.rules,
      // ...tsEslint.configs['recommended-type-checked']?.rules,
      // ...tsEslint.configs['stylistic-type-checked']?.rules,

      '@typescript-eslint/sort-type-constituents': 'off', // prefer logical rather than alphabetical sorting

      // 'svelte/valid-compile': 'off', // throws error on a11y issues without recourse
      // 'svelte/no-at-html-tags': ['warn'],

      'a11y-click-events-have-key-events': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',

      // 'no-unused-vars': 'off', // is marking enum values as unused
      'prefer-template': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    }
  },
  allowScriptLogs,
]);

