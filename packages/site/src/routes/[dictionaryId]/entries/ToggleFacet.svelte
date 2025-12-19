<script lang="ts">
  import { onDestroy } from 'svelte'
  import { slide } from 'svelte/transition'

  interface Props {
    checked: boolean;
    uncheck_when_destroyed?: boolean;
    count: number;
    label: string;
  }

  let {
    checked = $bindable(),
    uncheck_when_destroyed = false,
    count,
    label
  }: Props = $props();
  let id = $derived(label.replace(' ', ''))

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
  <div class="w-2"></div>
  <label for={id} class="block text-sm text-gray-900">
    {label}
    <span class="text-xs text-gray-600"> ({count}) </span>
  </label>
</div>
