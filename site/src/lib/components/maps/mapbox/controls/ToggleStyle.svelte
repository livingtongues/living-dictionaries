<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import IconFaSolidGlobeAsia from '~icons/fa-solid/globe-asia'
  import type { Style } from 'mapbox-gl'
  import { mapKey } from '../context'
  import type { MapKeyContext } from '../context'

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  interface Props {
    alternateStyle?: string // 'Mapbox Satellite Streets'
  }

  const { alternateStyle = 'mapbox://styles/mapbox/satellite-streets-v12?optimize=true' }: Props = $props()
  let initialStyle: Style

  onMount(() => {
    initialStyle = map.getStyle()
  })

  function toggleStyle() {
    const style = map.getStyle()
    if (style.name === initialStyle.name)
      map.setStyle(alternateStyle)
    else
      map.setStyle(initialStyle)
  }
</script>

<button
  onclick={toggleStyle}
  type="button"
  class="toggle-style"
  style="bottom: 40px; left: 8px; z-index: 1;">
  <IconFaSolidGlobeAsia />
</button>

<style>
  .toggle-style {
    padding: 0.25rem 0.5rem;
    position: absolute;
    border-radius: 0.25rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
    background-color: var(--background);
  }
</style>
