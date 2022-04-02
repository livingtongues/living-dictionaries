// @ts-check
import { defineConfig } from 'windicss/helpers';
import colors from 'windicss/colors';
import forms from 'windicss/plugin/forms';
// import typography from 'windicss/plugin/typography'; // causes occasional call stack size exceeded build bug

export default defineConfig({
  theme: {
    extend: {
      colors: {
        primary: colors.blue,
      },
    },
    // screens: {
    //   print: { raw: 'print' }, // didn't work as described in https://windicss.org/utilities/general/variants.html#raw-media-queries
    // },
  },
  plugins: [
    forms,
    // typography,
  ]
});
