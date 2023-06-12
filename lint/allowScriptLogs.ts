import { FlatESLintConfigItem } from 'eslint-define-config';

export const allowScriptLogs: FlatESLintConfigItem = {
  files: ['packages/scripts/**'],
  rules: {
    'no-console': 'off',
  },
}