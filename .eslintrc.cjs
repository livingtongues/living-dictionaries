module.exports = {
  extends: [
    'eslint:recommended', // can remove after going through all rules and seeing if all are in @antfu or overridden
    '@antfu',
    'plugin:svelte/recommended',
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
    es2017: true, // @antfu has es6
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
      files: ['**/scripts/**'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-alert': 'off',
    'n/prefer-global/buffer': ['error', 'always'],
    'unused-imports/no-unused-vars': 'off',
    'prefer-template': 'off',
    // 'svelte/require-store-reactive-access': 'warn',
		// 'no-undef': 'off',

		// rules prior to @antfu import:
		// 'a11y-click-events-have-key-events': 'off',
		// '@typescript-eslint/no-var-requires': 'off',
		// '@typescript-eslint/no-unused-vars': 'off',
		// '@typescript-eslint/no-empty-function': 'off',
		// '@typescript-eslint/no-explicit-any': 'off',
		// '@typescript-eslint/explicit-module-boundary-types': 'off',
		// '@typescript-eslint/ban-ts-comment': 'off',
  },
}
