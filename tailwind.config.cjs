const colors = require('tailwindcss/colors');

const config = {
  mode: 'jit',
  purge: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'line-height': 1.5,
            p: {
              'margin-top': '0',
            },
          },
        },
        lg: {
          css: {
            p: {
              'margin-top': '0',
            },
          },
        },
      },
      colors: {
        primary: colors.blue,
        orange: colors.orange,
        red: colors.red,
      },
      screens: {
        print: { raw: 'print' },
        // => @media  print { ... }
      },
    },
  },
  // Needed?
  variants: {
    extend: {
      transformOrigin: ['direction'],
      inset: ['direction'],
      padding: ['direction'],
      margin: ['direction'],
      borderRadius: ['direction'],
      translate: ['direction'],
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-dir')(), //https://github.com/RonMelkhior/tailwindcss-dir
  ],
};

module.exports = config;
