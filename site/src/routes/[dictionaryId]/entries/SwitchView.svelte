<script lang="ts">
  import { page } from '$app/state'
  import type { View } from '$lib/search/types'
  import IconFaSolidList from '~icons/fa-solid/list'
  import IconFaTable from '~icons/fa/table'
  import IconIcOutlineImage from '~icons/ic/outline-image'
  import IconFaPrint from '~icons/fa/print'

  interface Props {
    view: View
    can_print?: boolean
  }

  let { view = $bindable(), can_print = false }: Props = $props()
</script>

<div class="switcher">
  <button
    type="button"
    onclick={() => view = null}
    class:active={!view}>
    <IconFaSolidList style="margin-top: -0.25rem" />
    <span class="view-label">
      {page.data.t('entry.list')}
    </span>
  </button>
  <div class="view-gap"></div>
  <button
    type="button"
    onclick={() => view = 'table'}
    class:active={view === 'table'}>
    <IconFaTable style="margin-top: -0.25rem" />
    <span class="view-label">
      {page.data.t('entry.table')}
    </span>
  </button>
  <div class="view-gap"></div>
  <button
    type="button"
    onclick={() => view = 'gallery'}
    class:active={view === 'gallery'}>
    <IconIcOutlineImage style="margin-top: -0.25rem; font-size: 1.125rem" />
    <span class="view-label">
      {page.data.t('entry.gallery')}
    </span>
  </button>
  {#if can_print}
    <div class="view-gap"></div>
    <button
      type="button"
      onclick={() => view = 'print'}
      class:active={view === 'print'}>
      <IconFaPrint style="margin-top: -0.25rem" />
      <span class="view-label">
        {page.data.t('entry.print')}
      </span>
    </button>
  {/if}
</div>

<style>
  .switcher {
    display: flex;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  button {
    padding: 0.5rem;
    border-radius: 0.25rem;
  }

  button:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  .active {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    border: 1px solid var(--border-color);
  }

  .view-label,
  .view-gap {
    display: none;
  }

  .view-gap {
    width: 0.25rem;
  }

  @media (min-width: 768px) {
    .view-label {
      display: inline;
    }

    .view-gap {
      display: block;
    }
  }
</style>
