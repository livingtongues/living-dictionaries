<script lang="ts">
  import { page } from '$app/state'
  import { append_child_key, first_multistring_value, move_down_key, move_up_key } from './grammar-tree'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  const { t, dictionary, dict_db } = $derived(page.data)

  // Slot names are stored per analysis language; the manager edits the primary one.
  const primary_lang = $derived(dictionary.gloss_languages?.[0] || 'en')

  const slots = $derived([...(dict_db?.clause_slots.rows ?? [])]
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || '')))

  let new_name = $state('')

  async function add_slot() {
    const name = new_name.trim()
    if (!name) return
    const sort_key = append_child_key(slots.map(slot => slot.sort_key))
    await dict_db.clause_slots.insert({ name: { [primary_lang]: name }, sort_key })
    new_name = ''
  }

  async function rename(slot: typeof slots[number], value: string) {
    slot.name = { ...(slot.name || {}), [primary_lang]: value }
    await slot._save()
  }

  async function set_code(slot: typeof slots[number], value: string) {
    slot.code = value.trim() || null
    await slot._save()
  }

  async function reorder(index: number, direction: 'up' | 'down') {
    const keys = slots.map(slot => slot.sort_key)
    const sort_key = direction === 'up' ? move_up_key(keys, index) : move_down_key(keys, index)
    if (!sort_key) return
    const slot = slots[index]
    slot.sort_key = sort_key
    await slot._save()
  }

  async function remove(slot: typeof slots[number]) {
    if (!confirm(t('grammar.delete_slot_confirm'))) return
    await dict_db.clause_slots.delete(slot.id)
  }
</script>

<div class="slot-manager">
  <span class="heading">{t('grammar.clause_slots')}</span>

  {#if slots.length}
    <ul class="slot-list">
      {#each slots as slot, index (slot.id)}
        <li class="slot-row">
          <input
            type="text"
            class="name-input"
            value={first_multistring_value(slot.name, [primary_lang])}
            placeholder={t('grammar.slot_name')}
            onchange={event => rename(slot, event.currentTarget.value)} />
          <input
            type="text"
            class="code-input"
            value={slot.code || ''}
            placeholder={t('grammar.slot_code')}
            onchange={event => set_code(slot, event.currentTarget.value)} />
          <div class="row-controls">
            <button type="button" class="ctrl" title={t('grammar.move_up')} aria-label={t('grammar.move_up')} disabled={index === 0} onclick={() => reorder(index, 'up')}>
              <IconMdiChevronUp />
            </button>
            <button type="button" class="ctrl" title={t('grammar.move_down')} aria-label={t('grammar.move_down')} disabled={index >= slots.length - 1} onclick={() => reorder(index, 'down')}>
              <IconMdiChevronDown />
            </button>
            <button type="button" class="ctrl danger" title={t('misc.delete')} aria-label={t('misc.delete')} onclick={() => remove(slot)}>
              <IconSystemUiconsTrash />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="add-slot">
    <input
      type="text"
      class="name-input"
      bind:value={new_name}
      placeholder={t('grammar.slot_name')}
      onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add_slot() } }} />
    <button type="button" class="btn-outline btn-sm" disabled={!new_name.trim()} onclick={add_slot}>
      <IconFaSolidPlus /> {t('grammar.add_clause_slot')}
    </button>
  </div>
</div>

<style>
  .slot-manager {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color) 3%, var(--background));
  }

  .heading {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.5rem;
  }

  .slot-list {
    list-style: none;
    padding: 0;
    margin: 0 0 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .slot-row,
  .add-slot {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .name-input,
  .code-input {
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
  }

  .name-input {
    flex: 1;
    min-width: 0;
  }

  .code-input {
    width: 8rem;
    flex-shrink: 0;
  }

  .row-controls {
    display: flex;
    gap: 0.125rem;
    flex-shrink: 0;
  }

  .ctrl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .ctrl:hover:not(:disabled) {
    background: var(--surface);
    color: var(--color);
  }

  .ctrl:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ctrl.danger:hover {
    color: var(--danger);
  }
</style>
