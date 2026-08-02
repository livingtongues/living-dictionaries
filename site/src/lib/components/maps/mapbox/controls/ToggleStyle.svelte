<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import IconFaSolidGlobeAsia from '~icons/fa-solid/globe-asia'
  import type { Style } from 'mapbox-gl'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'

  const { get_map } = getContext<MapKeyContext>(map_key)
  const map = get_map()

  interface Props {
    alternate_style?: string // 'Mapbox Satellite Streets'
  }

  const { alternate_style = 'mapbox://styles/mapbox/satellite-streets-v12?optimize=true' }: Props = $props()
  let initial_style: Style

  onMount(() => {
    initial_style = map.getStyle()
  })

  function toggle_style() {
    const style = map.getStyle()
    if (style.name === initial_style.name)
      map.setStyle(alternate_style)
    else
      map.setStyle(initial_style)
  }
</script>

<button
  onclick={toggle_style}
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
