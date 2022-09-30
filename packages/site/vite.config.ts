import { sveltekit } from '@sveltejs/kit/vite';
// import { svelte } from '@sveltejs/vite-plugin-svelte';
import WindiCSS from 'vite-plugin-windicss';

// keeps using localhost https://github.com/vitejs/vite/issues/9195
import dns from 'dns';
dns.setDefaultResultOrder('verbatim');

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    WindiCSS({
      config: './windi.config.ts'
    }),
    // Add Uno for icons
    sveltekit(),
  ],
  server: {
    port: 3041,
    strictPort: false,
  },
  // envDir: '../../',
  build: {
    target: 'es2015',
  },
  define: {
    'import.meta.vitest': false,
    'import.meta.env.VERCEL_ANALYTICS_ID': JSON.stringify(process.env.VERCEL_ANALYTICS_ID),
  },
  test: {
    // plugins: [svelte({ hot: !process.env.VITEST })],
    globals: true,
    // includeSource: ['src/**/*.ts'],
  },
};

export default config;
