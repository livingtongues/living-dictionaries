// @ts-check
import { defineFlatConfig } from 'eslint-define-config'

export const scriptExceptions = defineFlatConfig({
  files: ['packages/{scripts,functions}/**'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
})
