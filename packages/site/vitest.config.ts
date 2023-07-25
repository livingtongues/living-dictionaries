import { defineProject } from 'vitest/config'
import path from 'node:path'
// import { resolve } from 'node:path'
// import { fileURLToPath, URL } from 'node:url'
// const projectDir = fileURLToPath(new URL('.', import.meta.url))

// import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineProject({
  test: {
    alias: {
      $lib: path.join(__dirname, './src/lib'),
      // $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
      // $lib: resolve(projectDir, './src/lib'),
      // $lib: new URL('./src/lib', import.meta.url).pathname,
    },
    name: 'site:unit',
    globals: true,
    includeSource: ['src/**/*.ts'],
    // plugins: [
    //   svelte({
    //     hot: false,
    //     configFile: path.join(__dirname, 'svelte.config.js')
    //   })
    // ],
  },
})
