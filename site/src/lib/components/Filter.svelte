<script lang="ts" generics="T">
  import { filter_items } from './filter-items'

  interface Props {
    // type T = $$Generic
    items: T[]
    placeholder?: string
    right?: import('svelte').Snippet<[any]>
    children?: import('svelte').Snippet<[any]>
  }

  const {
    items,
    placeholder = 'Search',
    right,
    children,
  }: Props = $props()

  let value = $state('')

  const filteredItems = $derived(filter_items({ items, query: value }))

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }
</script>

<div class="filter-row">
  <input type="search" bind:value use:autofocus placeholder={`${placeholder} (${items.length})`} />
  <div class="gap"></div>
  {@render right?.({ filteredItems })}
</div>

{@render children?.({ filteredItems })}

<style>
  .filter-row {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .gap {
    margin-right: 0.25rem;
  }

  /* Base input chrome (padding, appearance, placeholder color, focus ring geometry)
     comes from the presetForms element preflights — archived at the uno flip. */
  input {
    flex-grow: 1;
    display: block;
    border-width: 1px;
    border-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    border-radius: 0.25rem;
    color: var(--color);
  }

  input:focus {
    --un-ring-color: rgb(147 197 253); /* focus:ring-blue-300 — ring geometry from the forms preflight */
    border-color: rgb(147 197 253);
  }
</style>
