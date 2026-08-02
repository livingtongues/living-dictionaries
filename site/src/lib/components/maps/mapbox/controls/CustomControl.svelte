<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import type { IControl } from 'mapbox-gl'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'

  const { get_map } = getContext<MapKeyContext>(map_key)
  const map = get_map()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
    children?: import('svelte').Snippet<[any]>
  }

  const { position = 'top-right', children }: Props = $props()

  let el: HTMLDivElement = $state()

  onMount(() => {
    const custom_control: IControl = {
      onAdd(_map) {
        return el
      },
      // Mapbox moves `el` into its control container (outside Svelte's anchor range),
      // so Svelte teardown can't reach it — the IControl contract makes onRemove
      // responsible for detaching the element.
      onRemove() {
        // eslint-disable-next-line svelte/no-dom-manipulating -- mapbox reparents `el`; Svelte teardown can't reach it
        el.remove()
      },
    }
    map.addControl(custom_control, position)
    return () => {
      map.removeControl(custom_control)
    }
  })
</script>

<div bind:this={el} class="mapboxgl-ctrl mapboxgl-ctrl-group">
  {@render children?.({ map })}
</div>
