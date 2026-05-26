<script lang="ts">
  import { init_color_scheme } from '$lib/dark-mode.js'
  import { onMount } from 'svelte'
  import '$lib/theme.css'

  let { children } = $props()

  onMount(() => {
    init_color_scheme()
  })
</script>

{@render children()}
