<script lang="ts">
  import type { ColorScheme } from '$lib/dark-mode.js'
  import { get_color_scheme, set_color_scheme } from '$lib/dark-mode.js'
  import { onMount } from 'svelte'

  let scheme = $state<ColorScheme>('system')

  onMount(() => {
    scheme = get_color_scheme()
  })

  const scheme_icon: Record<ColorScheme, string> = {
    system: 'i-mdi-monitor',
    light: 'i-mdi-weather-sunny',
    dark: 'i-mdi-moon-waning-crescent',
  }

  const scheme_label: Record<ColorScheme, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  }

  function cycle() {
    const order: ColorScheme[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(scheme) + 1) % order.length]
    scheme = next
    set_color_scheme(next)
  }

  const swatches = [
    { name: '--primary', value: 'var(--primary)', label_on: 'var(--on-primary)' },
    { name: '--surface', value: 'var(--surface)', label_on: 'var(--color)' },
    { name: '--border-color', value: 'var(--border-color)', label_on: 'var(--color)' },
    { name: '--background', value: 'var(--background)', label_on: 'var(--color)' },
    { name: '--color', value: 'var(--color)', label_on: 'var(--background)' },
    { name: '--color-secondary', value: 'var(--color-secondary)', label_on: 'var(--background)' },
    { name: '--danger', value: 'var(--danger)', label_on: '#ffffff' },
    { name: '--warning', value: 'var(--warning)', label_on: '#ffffff' },
  ]
</script>

<div class="p-6 flex flex-col gap-4 text-[var(--color)]">
  <div>
    <h1 class="text-xl font-bold flex items-center gap-2">
      <span class="i-mdi-palette"></span>
      Welcome
    </h1>
    <p class="text-[var(--color-secondary)] text-sm mt-1">Theme + dark-mode reference</p>
  </div>

  <button type="button" class="btn-outline btn-default flex items-center gap-2 self-start" onclick={cycle}>
    <span class={scheme_icon[scheme]}></span>
    {scheme_label[scheme]}
  </button>

  <div class="grid grid-cols-2 gap-2">
    {#each swatches as swatch (swatch.name)}
      <div
        class="px-3 py-3 rounded-md text-xs font-mono border border-[var(--border-color)]"
        style="background: {swatch.value}; color: {swatch.label_on}">
        {swatch.name}
      </div>
    {/each}
  </div>

  <div class="flex gap-2">
    <button type="button" class="btn btn-default">Primary</button>
    <button type="button" class="btn-outline btn-default">Outline</button>
    <button type="button" class="btn-ghost btn-default">Ghost</button>
  </div>
</div>
