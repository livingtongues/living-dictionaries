/**
 * @type {import('eslint-define-config').FlatESLintConfigItem}
 */
export const allowScriptLogs = {
  files: ['packages/{scripts,functions}/**',],
  rules: {
    'no-console': 'off',
  },
};