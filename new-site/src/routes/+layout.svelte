<script lang="ts">
  import favicon from '$lib/assets/favicon.svg'
  import { init_color_scheme } from '$lib/dark-mode.js'
  import { onMount } from 'svelte'
  import '$lib/theme.css'

  let { children } = $props()

  onMount(() => {
    init_color_scheme()
  })
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
