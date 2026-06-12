<script lang="ts">
  import IconFa6SolidAnglesLeft from '~icons/fa6-solid/angles-left'
  import IconFa6SolidAngleLeft from '~icons/fa6-solid/angle-left'
  import IconFa6SolidAngleRight from '~icons/fa6-solid/angle-right'
  import IconFa6SolidAnglesRight from '~icons/fa6-solid/angles-right'

  interface Props {
    pages: number
    current_page: number
    go_to_page: (page: number) => void
    children?: import('svelte').Snippet
  }

  const {
    pages,
    current_page,
    go_to_page,
    children,
  }: Props = $props()

  function center_current(node: HTMLElement, active = false) {
    if (active) center()

    function center() {
      setTimeout(() => {
        node?.scrollIntoView({ behavior: 'instant', inline: 'center' })
        window.scrollTo({ top: 0 })
      }, 50)
    }

    return {
      update(active: boolean) {
        if (active) center()
      },
    }
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
</script>

<div class="pagination-row">
  {#if current_page > 2}
    <button
      type="button"
      class="edge-button"
      onclick={() => go_to_page(1)}>
      <IconFa6SolidAnglesLeft class="icon-inline rtl-x-flip" /></button>
  {/if}

  {#if current_page > 1}
    <button
      type="button"
      onclick={() => go_to_page(current_page - 1)}>
      <IconFa6SolidAngleLeft class="icon-inline rtl-x-flip" /></button>
  {/if}

  <div class="pages-scroll no-scrollbar">
    {#each { length: pages } as _, index (index)}
      {@const current = index + 1 === current_page}
      <button
        type="button"
        use:center_current={current}
        class:current
        onclick={() => go_to_page(index + 1)}>{index + 1}</button>
    {/each}
  </div>

  {#if current_page < pages}
    <button
      type="button"
      onclick={() => go_to_page(current_page + 1)}>
      <IconFa6SolidAngleRight class="icon-inline rtl-x-flip" /></button>
  {/if}

  {#if current_page < pages - 1}
    <button
      type="button"
      class="edge-button"
      onclick={() => go_to_page(pages)}>
      <IconFa6SolidAnglesRight class="icon-inline rtl-x-flip" /></button>
  {/if}

  {@render children?.()}
</div>

<svelte:window
  onkeydown={(event) => {
    const ctrl = isMac ? event.metaKey : event.ctrlKey
    if (event.key === 'j' && ctrl) {
      event.preventDefault()
      const page = prompt('Go to page:')
      if (page) go_to_page(+page)
    }
  // Requires way to keep keystrokes from spilling out of modal before using
    // if (event.key === 'ArrowLeft' && event.altKey && current_page > 1) go_to_page(current_page - 1)
    // if (event.key === 'ArrowRight' && event.altKey && current_page < pages) go_to_page(current_page + 1)
  }} />

<style>
  .pagination-row {
    display: flex;
    align-items: center;
    max-width: 100%;
    flex-grow: 1;
  }

  .edge-button {
    display: none;
  }

  @media (min-width: 640px) {
    .edge-button {
      display: block;
    }
  }

  .pages-scroll {
    overflow-x: auto;
    display: flex;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
  }

  button {
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: var(--color-secondary); /* ≈ gray-500 */
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  button:hover {
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    background-color: var(--surface); /* ≈ gray-100 */
  }

  button:focus {
    color: var(--color); /* ≈ gray-800 */
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .current {
    background-color: rgb(219 234 254); /* blue-100 */
    color: rgb(29 78 216); /* blue-700 */
  }

  .current:focus {
    background-color: rgb(191 219 254); /* blue-200 */
    color: rgb(30 64 175); /* blue-800 */
  }

  button :global(.icon-inline) {
    margin-top: -0.25rem;
  }

  .no-scrollbar::-webkit-scrollbar {
    width: 0px;
    height: 0px;
  }
</style>
