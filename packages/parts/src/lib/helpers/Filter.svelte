<script lang="ts">
  type T = $$Generic;
  export let items: T[];
  export let placeholder = 'Search';
  let value = '';
  $: filteredItems = items.filter((item) => {
    const itemStr = JSON.stringify(item);
    if (itemStr.toLowerCase().indexOf(value.toLowerCase()) !== -1) {
      return true;
    }
  });

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15);
  }
</script>

<div class="flex items-center mb-2">
  <input type="search" bind:value use:autofocus placeholder={`${placeholder} (${items.length})`} />
  <div class="mr-1" />
  <slot name="right" />
</div>
<slot {filteredItems} />

<style>
  input {
    @apply flex-grow appearance-none block px-3 py-2 border
        border-gray-300 rounded text-gray-900 placeholder-gray-500
        focus:outline-none focus:ring-blue-300 focus:border-blue-300;
  }
</style>
