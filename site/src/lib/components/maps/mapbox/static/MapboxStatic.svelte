<script lang="ts">
  import type { IPoint, IRegion } from '$lib/types'
  import { browser } from '$app/environment'
  import { is_dark_mode } from '$lib/state/color-mode.svelte'
  import { map_static_url } from '$api/map-static/_call'

  interface Props {
    points?: IPoint[]
    regions?: IRegion[]
    width?: number
    height?: number
    single_point_zoom?: number
    alt?: string
    /** Cover the parent box (image AND dummy-token placeholder) instead of rendering at the requested pixel size. */
    fill?: boolean
  }

  const {
    points = [],
    regions = [],
    width = 300,
    height = 200,
    single_point_zoom = 3,
    alt = 'Map',
    fill = false,
  }: Props = $props()

  // Browser-only: SSR can't know the visitor's color mode, and a light-mode
  // image swapped for dark after hydration would double-hit the server cache.
  const src = $derived(browser
    ? map_static_url({ points, regions, width, height, mode: is_dark_mode() ? 'dark' : 'light', single_point_zoom })
    : null)
  let failed = $state(false)
</script>

{#if src && !failed}
  <img class:fill {alt} {src} width={width * 2} height={height * 2} loading="lazy" onerror={() => (failed = true)} />
{:else}
  <div style={fill ? undefined : `aspect-ratio: ${width} / ${height}; width: ${width * 2}px`} class="static-placeholder" class:fill></div>
{/if}

<style>
  img {
    max-width: 100%;
    height: auto;
  }

  .static-placeholder {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    max-width: 100%;
    max-height: 100%;
  }

  .fill {
    width: 100%;
    height: 100%;
    display: block;
  }

  img.fill {
    object-fit: cover;
  }
</style>
