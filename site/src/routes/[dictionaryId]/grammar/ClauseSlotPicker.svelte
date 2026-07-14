<script lang="ts">
  import { page } from '$app/state'
  import { first_multistring_value } from './grammar-tree'

  interface Props {
    /** The section's `slot_id` draft — two-way bound. */
    value: string | null
  }

  let { value = $bindable() }: Props = $props()

  const { t, dictionary, dict_db } = $derived(page.data)

  const slots = $derived([...(dict_db?.clause_slots.rows ?? [])]
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || '')))

  function slot_label(name: Record<string, string> | null): string {
    return first_multistring_value(name, dictionary.gloss_languages)
  }
</script>

{#if slots.length}
  <div class="slot-picker">
    <span class="field-label">{t('grammar.clause_slot')}</span>
    <select
      class="slot-select"
      value={value ?? ''}
      onchange={event => value = (event.currentTarget.value || null)}>
      <option value="">{t('grammar.no_clause_slot')}</option>
      {#each slots as slot (slot.id)}
        <option value={slot.id}>{slot_label(slot.name) || slot.code || slot.id}</option>
      {/each}
    </select>
  </div>
{/if}

<style>
  .slot-picker {
    margin-top: 0.75rem;
  }

  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }

  .slot-select {
    padding: 0.4rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
    max-width: 22rem;
  }
</style>
