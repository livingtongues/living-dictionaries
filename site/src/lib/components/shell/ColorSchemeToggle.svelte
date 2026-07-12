<script lang="ts">
  import type { ColorScheme } from '$lib/state/dark-mode'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { get_color_scheme, set_color_scheme } from '$lib/state/dark-mode'
  import IconMdiBrightnessAuto from '~icons/mdi/brightness-auto'
  import IconMdiWhiteBalanceSunny from '~icons/mdi/white-balance-sunny'
  import IconMdiWeatherNight from '~icons/mdi/weather-night'

  interface Props {
    /** icon-only rendering (Footer); default shows "Appearance: X" label (UserMenu) */
    compact?: boolean
  }

  const { compact = false }: Props = $props()

  // hydrated in onMount so SSR always renders the 'system' state
  let color_scheme = $state<ColorScheme>('system')

  onMount(() => {
    color_scheme = get_color_scheme()
  })

  function cycle_color_scheme() {
    const order: ColorScheme[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(color_scheme) + 1) % order.length]
    color_scheme = next
    set_color_scheme(next)
  }

  const scheme_label = $derived({
    system: page.data.t('misc.theme_system'),
    light: page.data.t('misc.theme_light'),
    dark: page.data.t('misc.theme_dark'),
  }[color_scheme])
</script>

<button type="button" onclick={cycle_color_scheme} title="{page.data.t('misc.appearance')}: {scheme_label}">
  {#if color_scheme === 'system'}
    <IconMdiBrightnessAuto />
  {:else if color_scheme === 'light'}
    <IconMdiWhiteBalanceSunny />
  {:else}
    <IconMdiWeatherNight />
  {/if}
  {#if !compact}
    {scheme_label}
  {/if}
</button>
