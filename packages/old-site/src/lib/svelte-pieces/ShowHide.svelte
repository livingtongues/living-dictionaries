<script lang="ts">
  import type { Snippet } from 'svelte'

  const { children }: {
    children: Snippet<[{ show: boolean, toggle: () => void, set: (value: boolean) => void }]>
  } = $props()

  let show = $state(false)
  function toggle() {
    show = !show
  }
  function set(value: boolean) {
    show = value
  }
</script>

{@render children({ show, toggle, set })}
