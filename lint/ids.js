// @ts-check
import tsEslintPlugin from '@typescript-eslint/eslint-plugin'
import { defineFlatConfig } from 'eslint-define-config'

export const intercontinentalDictionarySeries = defineFlatConfig({
  files: ['**/ids-import/**'],
  plugins: {
    '@typescript-eslint': tsEslintPlugin,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-undef': 'off',
  }
})
