// @ts-check
import vitestPlugin from 'eslint-plugin-vitest'
import { defineFlatConfig } from 'eslint-define-config'

export const vitest = defineFlatConfig({
  files: [
    '**/*.test.ts',
  ],

  plugins: {
    vitest: vitestPlugin,
  },

  rules: {
    // turn to errors
    'vitest/no-commented-out-tests': 'warn',
    'vitest/no-disabled-tests': 'warn',

    'vitest/consistent-test-filename': 'error',
    'vitest/expect-expect': 'error',
    'vitest/consistent-test-it': ['error', { fn: 'test' }],
    'vitest/no-alias-methods': 'error',
    'vitest/no-conditional-expect': 'error',
    'vitest/no-conditional-in-test': 'error',
    'vitest/no-conditional-tests': 'error',
    'vitest/no-duplicate-hooks': 'error',
    'vitest/no-focused-tests': 'error',
    'vitest/no-identical-title': 'error',
    'vitest/no-standalone-expect': 'error',
    'vitest/no-test-return-statement': 'error',
    'vitest/prefer-comparison-matcher': 'error',
    'vitest/prefer-hooks-in-order': 'error',
    'vitest/prefer-hooks-on-top': 'error',
    'vitest/prefer-lowercase-title': 'error',
    'vitest/prefer-spy-on': 'error',
    'vitest/prefer-to-be-falsy': 'error',
    'vitest/prefer-to-be-truthy': 'error',
    'vitest/prefer-to-contain': 'error',
    'vitest/prefer-to-have-length': 'error',
    'vitest/valid-describe-callback': 'error',
    'vitest/valid-expect': 'error',
    // 'vitest/require-top-level-describe': 'error',
    // 'vitest/valid-title': ['error', { 'allowArguments': true }],
  },
})
