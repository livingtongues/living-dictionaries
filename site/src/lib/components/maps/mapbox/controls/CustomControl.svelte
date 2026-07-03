<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import type { IControl } from 'mapbox-gl'
  import { mapKey } from '../context'
  import type { MapKeyContext } from '../context'

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
    children?: import('svelte').Snippet<[any]>
  }

  const { position = 'top-right', children }: Props = $props()

  let el: HTMLDivElement = $state()

  onMount(() => {
    const customControl: IControl = {
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
    map.addControl(customControl, position)
    return () => {
      map.removeControl(customControl)
    }
  })
</script>

<div bind:this={el} class="mapboxgl-ctrl mapboxgl-ctrl-group">
  {@render children?.({ map })}
</div>
