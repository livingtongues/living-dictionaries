// @ts-check
import globals from 'globals'
import tsEslintPlugin from '@typescript-eslint/eslint-plugin'
// @ts-expect-error
import typescriptParser from '@typescript-eslint/parser'

export const typescript = {
  files: ['**/*.ts', '**/*.js', '**/*.svelte', '**/*.svx'],
  plugins: {
    '@typescript-eslint': tsEslintPlugin,
  },
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      extraFileExtensions: ['.svelte', '.svx'],
    },
    globals: {
      ...globals.browser,
      ...globals.es2021,
      ...globals.node,
      ...globals.worker,
      ...globals.jest,
    },
  },
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
  rules: {
    ...tsEslintPlugin.configs.recommended?.rules,
    ...tsEslintPlugin.configs.stylistic?.rules,
    '@typescript-eslint/sort-type-constituents': 'off', // prefer logical rather than alphabetical sorting
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    '@typescript-eslint/no-unused-vars': [ 'error', { 'argsIgnorePattern': '^_', 'caughtErrors': 'all', 'ignoreRestSiblings': true } ],
    '@typescript-eslint/quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    // '@typescript-eslint/semi': ['error', 'never'],
    'prefer-const': 'error',
    'no-duplicate-imports': ['error', { 'includeExports': true }],
    'no-constant-binary-expression': 'error',
    'no-template-curly-in-string': 'error',
    'no-unmodified-loop-condition': 'error',
    'require-atomic-updates': 'error',
    'dot-notation': 'error',
    'no-else-return': 'error',
    'no-unneeded-ternary': 'error',
    'no-unused-expressions': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-object-spread': 'error',
    'no-undef': 'warn', // may just turn off as has lots of conflicts

    // Warnings to move to errors in time:
    'no-trailing-spaces': 'warn',
    'eol-last': 'warn',
    'comma-dangle': ['warn', 'only-multiline'],
    'require-await': 'warn',
    'curly': ['warn', 'multi-or-nest', 'consistent'],
    'no-await-in-loop': 'warn',
    'default-param-last': 'warn',
    'no-magic-numbers': ['warn', { 'ignore': [ -1, 0, 1, 2, 60 ], 'ignoreArrayIndexes': true }],
    'prefer-named-capture-group': 'warn',
    'prefer-destructuring': 'warn',
    'prefer-regex-literals': 'warn',
    'prefer-rest-params': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',

    // Suggestions to try:
    // 'sort-imports': 'warn',
    // 'no-promise-executor-return': 'error', // has issue with "sleep" function
    // 'max-lines-per-function': ['error', 20]
    // 'no-return-await': 'error',
    // array-bracket-spacing
    // array-bracket-newline
    // array-element-newline
    // arrow-parens
    // arrow-spacing
    // block-spacing
    // brace-style
    // comma-dangle
    // comma-spacing
    // comma-style
    // dot-location
    // multiline-ternary
    // no-extra-parens
    // no-multiple-empty-lines
    // quotes


    // '@typescript-eslint/naming-convention': [
    //   'error',
    //   {
    //     'selector': 'default',
    //     'format': ['camelCase'],
    //     'leadingUnderscore': 'allow',
    //   },
    //   {
    //     'selector': 'default',
    //     'modifiers': ['const'],
    //     'format': ['camelCase', 'UPPER_CASE'],
    //     'leadingUnderscore': 'allow',
    //   },
    //   {
    //     'selector': ['typeLike', 'enumMember'],
    //     'format': ['PascalCase'],
    //   },
    //   {
    //     'selector': 'default',
    //     'modifiers': ['requiresQuotes'],
    //     'format': null,
    //   },
    // ],
  },
}
