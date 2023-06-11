// @ts-check
import jsEslintPlugin from '@eslint/js';
import { defineFlatConfig } from 'eslint-define-config';
import typescriptParser from '@typescript-eslint/parser';
import tsEslint from '@typescript-eslint/eslint-plugin'
import globals from 'globals'

// import vitest from 'eslint-plugin-vitest'

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
    ],
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
    }
  },

]);

const vitestConfig = {
  files: [
    '**/test/*.js',
    '**/test/*.ts',
    '**/test/*.jsx',
    '**/test/*.tsx',
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.test.jsx',
    '**/*.test.tsx',
  ],

  plugins: {
    // vitest,
  },

  rules: {
    'vitest/consistent-test-filename': 'error',
    'vitest/consistent-test-it': ['error', { fn: 'it' }],
    'vitest/no-alias-methods': 'error',
    'vitest/no-commented-out-tests': 'error',
    'vitest/no-conditional-expect': 'error',
    'vitest/no-conditional-in-test': 'error',
    'vitest/no-conditional-tests': 'error',
    'vitest/no-disabled-tests': 'error',
    'vitest/no-duplicate-hooks': 'error',
    'vitest/no-focused-tests': 'error',
    'vitest/no-identical-title': 'error',
    'vitest/no-standalone-expect': 'error',
    'vitest/no-test-return-statement': 'error',
    'vitest/prefer-comparison-matcher': 'error',
    'vitest/prefer-expect-resolves': 'error',
    'vitest/prefer-hooks-in-order': 'error',
    'vitest/prefer-hooks-on-top': 'error',
    'vitest/prefer-lowercase-title': 'error',
    'vitest/prefer-spy-on': 'error',
    'vitest/prefer-to-be-falsy': 'error',
    'vitest/prefer-to-be-truthy': 'error',
    'vitest/prefer-to-be': 'error',
    'vitest/prefer-to-contain': 'error',
    'vitest/prefer-to-have-length': 'error',
    'vitest/require-top-level-describe': 'error',
    'vitest/valid-describe-callback': 'error',
    'vitest/valid-expect': 'error',
  },
}