import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: { port: 3099 },
  // Serve svelte from raw source so runtime instrumentation (debugging the
  // dep-tracking internals) is actually what the browser executes.
  optimizeDeps: { exclude: ['svelte'] },
})
