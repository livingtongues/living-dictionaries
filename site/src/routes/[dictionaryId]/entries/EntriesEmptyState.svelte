<script lang="ts">
  import type { Tables } from '$lib/types'
  import type { DbOperations } from '$lib/dbOperations'
  import { page } from '$app/stores'
  import AddEntry from './AddEntry.svelte'
  import IconFa6SolidBookOpen from '~icons/fa6-solid/book-open'
  import IconFa6SolidRobot from '~icons/fa6-solid/robot'
  import IconFa6SolidArrowRight from '~icons/fa6-solid/arrow-right'

  interface Props {
    dictionary: Tables<'dictionaries'>
    can_edit: boolean
    is_manager: boolean
    add_entry: DbOperations['insert_entry']
  }

  const { dictionary, can_edit, is_manager, add_entry }: Props = $props()
</script>

<div class="empty-state">
  <div class="icon-circle">
    <IconFa6SolidBookOpen class="icon-inline" style="font-size: 1.75rem" />
  </div>

  {#if can_edit}
    <h2>This dictionary is empty</h2>
    <p class="sub">Add your first word to begin documenting {dictionary.name}.</p>

    <div class="primary-action">
      <AddEntry {add_entry} class="empty-add-entry" />
    </div>

    {#if is_manager}
      <a class="agent-line" href={`/${dictionary.url}/agents`}>
        <IconFa6SolidRobot class="icon-inline" style="font-size: 0.9rem" />
        Working with an AI agent? Create a key
        <IconFa6SolidArrowRight class="icon-inline rtl-x-flip" style="font-size: 0.8rem" />
      </a>
    {/if}
  {:else}
    <h2>No entries yet</h2>
    <p class="sub">{dictionary.name} doesn't have any entries to show yet — check back soon.</p>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3.5rem 1rem 4rem;
    max-width: 30rem;
    margin: 0 auto;
  }

  .icon-circle {
    width: 4rem;
    height: 4rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    background-color: color-mix(in srgb, var(--background), var(--color) 8%);
    color: var(--color-secondary);
  }

  h2 {
    font-size: 1.375rem;
    font-weight: 600;
    margin-bottom: 0.375rem;
  }

  .sub {
    color: color-mix(in srgb, var(--color) 70%, var(--background));
    margin-bottom: 1.5rem;
    line-height: 1.4;
  }

  .primary-action {
    margin-bottom: 1.25rem;
  }

  .empty-state :global(.empty-add-entry) {
    font-size: 1rem;
    padding: 0.625rem 1.5rem;
  }

  .agent-line {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-secondary);
  }

  .agent-line:hover {
    color: var(--color);
    text-decoration: underline;
  }
</style>
