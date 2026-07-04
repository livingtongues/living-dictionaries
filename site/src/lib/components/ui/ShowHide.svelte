<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet<[{ show: boolean, toggle: () => void, set: (value: boolean) => void }]>
  }

  let { children }: Props = $props()

  let show = $state(false)

  function toggle() {
    show = !show
  }

  function set(value: boolean) {
    show = value
  }
</script>

{@render children({ show, toggle, set })}
