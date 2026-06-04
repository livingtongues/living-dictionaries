<script>
  import { SvelteSet } from 'svelte/reactivity'

  let { input, on_modified = undefined, children } = $props()

  const set = new SvelteSet()

  $effect(() => {
    set.clear()
    for (const item of input || [])
      set.add(item)
  })

  function update(newSet) {
    set.clear()
    for (const item of newSet || [])
      set.add(item)
  }
  function add(item) {
    set.add(item)
    on_modified?.(Array.from(set))
  }
  function remove(item) {
    set.delete(item)
    on_modified?.(Array.from(set))
  }

  const value = $derived(Array.from(set))
  const size = $derived(set.size)
</script>

{@render children?.({ value, add, update, remove, size })}
