/// <reference types="vitest/config" />
import type { PluginOption } from 'vite'
import UnoCSS from '@unocss/svelte-scoped/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

async function load_svelte_look(): Promise<PluginOption> {
  try {
    const { svelte_look } = await import('svelte-look/vite')
    return svelte_look() as PluginOption
  } catch {
    return false
  }
}

const plugins: PluginOption[] = [
  UnoCSS() as PluginOption,
  await load_svelte_look(),
  sveltekit(),
]

export default defineConfig({
  plugins,
})
