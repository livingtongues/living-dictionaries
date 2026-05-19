<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'

  interface Props {
    input?: T[]
    onmodified?: (array: T[]) => void
    children: Snippet<[{
      value: T[]
      add: (item: T) => void
      update: (newSet: T[]) => void
      remove: (item: T) => void
      size: number
    }]>
  }

  let {
    input = $bindable([]),
    onmodified = undefined,
    children,
  }: Props = $props()

  let set = $state<Set<T>>(new Set(input || []))

  $effect(() => {
    if (input) {
      set = new Set(input)
    } else {
      set = new Set()
    }
  })

  let value = $derived(Array.from(set))
  let size = $derived(set.size)

  function add(item: T) {
    set.add(item)
    set = new Set(set)
    onmodified?.(Array.from(set))
  }

  function update(newSet: T[]) {
    set = new Set(newSet)
    onmodified?.(Array.from(set))
  }

  function remove(item: T) {
    set.delete(item)
    set = new Set(set)
    onmodified?.(Array.from(set))
  }
</script>

{@render children({ value, add, update, remove, size })}
