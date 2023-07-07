/**
 * @type {import('eslint-define-config').FlatESLintConfigItem}
 */
export const scriptExceptions = {
  files: ['packages/{scripts,functions}/**'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
};
