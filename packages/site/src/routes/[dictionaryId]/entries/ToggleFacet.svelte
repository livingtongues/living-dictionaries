<script lang="ts">
  import { onDestroy } from 'svelte'
  import { slide } from 'svelte/transition'

  export let checked: boolean
  export let uncheck_when_destroyed = false
  export let count: number
  export let label: string
  $: id = label.replace(' ', '')

  onDestroy(() => {
    if (uncheck_when_destroyed)
      checked = false
  })
</script>

<div class="flex items-center my-2" transition:slide>
  <input
    {id}
    type="checkbox"
    bind:checked />
  <div class="w-2" />
  <label for={id} class="block text-sm text-gray-900">
    {label}
    <span class="text-xs text-gray-600"> ({count}) </span>
  </label>
</div>
