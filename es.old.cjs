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
}
