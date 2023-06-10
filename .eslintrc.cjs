module.exports = {
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    // '@unocss',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte'],
  },
  env: {
    browser: true,
    es2017: true,
    node: true,
  },
  overrides: [
    {
      files: ['*.svelte', '*.svx'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
      rules: {
        'import/no-mutable-exports': 'off',
        'no-undef-init': 'off',
        '@typescript-eslint/no-use-before-define': 'off', // has issue with declaring a reactive function after it's used
      },
    },
    {
      files: ['packages/scripts/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  rules: {
    'svelte/valid-compile': 'off', // throws error on a11y issues without recourse
    'svelte/no-at-html-tags': ['warn'],

    'a11y-click-events-have-key-events': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',

    'no-unused-vars': 'off', // is marking enum values as unused
    'prefer-template': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],


    // 'n/prefer-global/buffer': ['error', 'always'],
    // 'unused-imports/no-unused-vars': 'off',
    // 'svelte/require-store-reactive-access': 'warn',
    // 'no-undef': 'off',
  },
  // settings: {
  //   svelte: {
  //     ignoreWarnings: [
  //       "a11y-click-events-have-key-events",
  //     ],
  //   },
  // },
}
