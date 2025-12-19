<script lang="ts" generics="T">
  
  interface Props {
    // type T = $$Generic
    items: T[];
    placeholder?: string;
    right?: import('svelte').Snippet<[any]>;
    children?: import('svelte').Snippet<[any]>;
  }

  let {
    items,
    placeholder = 'Search',
    right,
    children
  }: Props = $props();

  let value = $state('')

  let filteredItems = $derived(items.filter((item: T) => {
    const itemStr = JSON.stringify(item)
    return itemStr.toLowerCase().includes(value.toLowerCase())
  }))

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }
</script>

<div class="flex items-center mb-2">
  <input type="search" bind:value use:autofocus placeholder={`${placeholder} (${items.length})`} />
  <div class="mr-1"></div>
  {@render right?.({ filteredItems, })}
</div>

{@render children?.({ filteredItems, })}

<style>
  input {
    --at-apply: flex-grow appearance-none block px-3 py-2 border
        border-gray-300 rounded text-gray-900 placeholder-gray-500
        focus:outline-none focus:ring-blue-300 focus:border-blue-300;
  }
</style>
