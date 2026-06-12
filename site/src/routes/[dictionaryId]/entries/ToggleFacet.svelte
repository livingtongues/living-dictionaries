<script lang="ts">
  import { onDestroy } from 'svelte'
  import { slide } from 'svelte/transition'

  interface Props {
    checked: boolean
    uncheck_when_destroyed?: boolean
    count: number
    label: string
  }

  let {
    checked = $bindable(),
    uncheck_when_destroyed = false,
    count,
    label,
  }: Props = $props()
  const id = $derived(label.replace(' ', ''))

  onDestroy(() => {
    if (uncheck_when_destroyed)
      checked = false
  })
</script>

<div class="facet-row" transition:slide>
  <input
    {id}
    type="checkbox"
    bind:checked />
  <div style="width: 0.5rem"></div>
  <label for={id}>
    {label}
    <span class="facet-count"> ({count}) </span>
  </label>
</div>

<style>
  .facet-row {
    display: flex;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  label {
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color); /* ≈ gray-900 */
  }

  .facet-count {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }
</style>
