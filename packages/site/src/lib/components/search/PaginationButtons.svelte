<script lang="ts">
  export let pages: number
  export let page_from_url: number
  export let go_to_page: (page: number) => void

  $: current_page = page_from_url || 1

  function center_current(node: HTMLElement, active = false) {
    if (active) center()

    function center() {
      node?.scrollIntoView({ behavior: 'instant', inline: 'center' })
      window.scrollTo({ top: 0 });
    }

    return {
      update(active: boolean) {
        if (active) center()
      },
    };
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
</script>

<div class="flex items-center max-w-full">
  {#if current_page > 2}
    <button
      type="button"
      class="hidden sm:block"
      on:click={() => go_to_page(1)}>
      <span class="i-fa6-solid-angles-left rtl-x-flip" /></button>
  {/if}

  {#if current_page > 1}
    <button
      type="button"
      on:click={() => go_to_page(current_page - 1)}>
      <span class="i-fa6-solid-angle-left rtl-x-flip" /></button>
  {/if}

  <div class="overflow-x-auto flex no-scrollbar shadow">
    {#each {length: pages} as _, index}
      {@const current = index + 1 === current_page}
      <button
        type="button"
        use:center_current={current}
        class:current
        on:click={() => go_to_page(index + 1)}>{index + 1}</button>
    {/each}
  </div>

  {#if current_page < pages}
    <button
      type="button"
      on:click={() => go_to_page(current_page + 1)}>
      <span class="i-fa6-solid-angle-right rtl-x-flip" /></button>
  {/if}

  {#if current_page < pages - 1}
    <button
      type="button"
      class="hidden sm:block"
      on:click={() => go_to_page(pages)}>
      <span class="i-fa6-solid-angles-right rtl-x-flip" /></button>
  {/if}

  <slot />
</div>

<svelte:window
  on:keydown={(event) => {
    if (event.key === 'j' && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault()
      const page = prompt('Go to page:')
      if (page) go_to_page(+page)
    }
  }} />

<style>
  button {
    --at-apply: rounded py-2 px-3 text-sm leading-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800 focus:outline-none transition ease-in-out duration-150;
  }
  .current {
    --at-apply: bg-blue-100 text-blue-700 focus:bg-blue-200 focus:text-blue-800;
  }
  span {
    --at-apply: -mt-1;
  }

  .no-scrollbar::-webkit-scrollbar {
    width: 0px;
    height: 0px;
  }
</style>
