// @ts-check
import { defineConfig } from 'windicss/helpers';
// import forms from 'windicss/plugin/forms'; https://github.com/windicss/windicss/issues/457
// import typography from 'windicss/plugin/typography'; // causes occasional call stack size exceeded build bug

export default defineConfig({
  // safelist: ['space-x-1, space-x-3'],
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },
    },
  },
  // plugins: [
  // forms,
  // typography,
  // ]
});
