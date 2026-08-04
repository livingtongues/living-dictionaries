<script lang="ts">
  import { get } from 'svelte/store'
  import type { EntrySelection } from './entry-selection.svelte'
  import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
  import Popover from '$lib/components/ui/Popover.svelte'
  import { page } from '$app/state'
  import { review_category_labels } from '$lib/entry/review-category'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import IconMdiTagOutline from '~icons/mdi/tag-outline'
  import IconMdiEarth from '~icons/mdi/earth'
  import IconMdiBookOpenVariant from '~icons/mdi/book-open-variant'
  import IconMdiFlagOutline from '~icons/mdi/flag-outline'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPlus from '~icons/mdi/plus'
  import IconMdiMinus from '~icons/mdi/minus'

  interface Props {
    selection: EntrySelection
    writes: GuardedWrites
  }

  const { selection, writes }: Props = $props()

  const { t } = $derived(page.data)
  const { tags: dictionary_tags, dialects: dictionary_dialects, sources, dict_db, entries_data } = $derived(page.data)

  let open_picker: 'tags' | 'dialects' | 'sources' | 'review' | null = $state(null)
  let picker_anchor: HTMLElement | null = $state(null)
  let busy = $state(false)
  let new_tag_name = $state('')

  const selected_ids = $derived([...selection.ids])

  function open(picker: typeof open_picker, event: MouseEvent) {
    picker_anchor = event.currentTarget as HTMLElement
    open_picker = open_picker === picker ? null : picker
  }

  async function run(action: () => Promise<void>) {
    if (busy || writes.check_ready()) return
    busy = true
    try {
      await action()
    } finally {
      busy = false
    }
  }

  async function bulk_delete() {
    if (!confirm(t('bulk.delete_confirm', { values: { count: String(selected_ids.length) } }))) return
    await run(async () => {
      for (const entry_id of selected_ids) {
        await writes.delete_entry(entry_id)
        selection.remove(entry_id)
      }
    })
  }

  async function bulk_tag({ tag_id, remove }: { tag_id: string, remove?: boolean }) {
    await run(async () => {
      for (const entry_id of selected_ids)
        await writes.assign_tag({ tag_id, entry_id, remove })
    })
  }

  async function bulk_create_tag() {
    const name = new_tag_name.trim()
    if (!name) return
    await run(async () => {
      const existing = get(dictionary_tags).find(tag => tag.name === name)
      const tag_id = existing?.id ?? (await writes.insert_tag({ name })).id
      for (const entry_id of selected_ids)
        await writes.assign_tag({ tag_id, entry_id })
      new_tag_name = ''
    })
  }

  async function bulk_dialect({ dialect_id, remove }: { dialect_id: string, remove?: boolean }) {
    await run(async () => {
      for (const entry_id of selected_ids)
        await writes.assign_dialect({ dialect_id, entry_id, remove })
    })
  }

  async function bulk_add_source(slug: string) {
    await run(async () => {
      const data = get(entries_data)
      for (const entry_id of selected_ids) {
        const entry = data[entry_id]
        if (!entry || entry.main.sources?.includes(slug)) continue
        const merged = [...(entry.main.sources || []), slug]
        entry.main.sources = merged
        await dict_db?.entries.update({ id: entry_id, sources: merged })
      }
    })
  }

  async function bulk_review(category: string | null) {
    await run(async () => {
      const data = get(entries_data)
      for (const entry_id of selected_ids) {
        const entry = data[entry_id]
        const review = category ? { category, note: '' } : null
        if (entry) entry.main.review = review
        await dict_db?.entries.update({ id: entry_id, review })
      }
    })
  }
</script>

{#if selection.ids.size}
  <div class="bulk-bar" class:busy>
    <span class="count">{t('bulk.selected', { values: { count: String(selection.ids.size) } })}</span>

    <button
      type="button"
      class="bar-button"
      class:active={selection.view_selected}
      onclick={() => selection.view_selected = !selection.view_selected}>
      {selection.view_selected ? t('bulk.view_results') : t('bulk.view_selected')}
    </button>

    <div class="divider"></div>

    <button type="button" class="bar-button" onclick={event => open('tags', event)}>
      <IconMdiTagOutline /> {t('bulk.tags')}
    </button>
    <button type="button" class="bar-button" onclick={event => open('dialects', event)}>
      <IconMdiEarth /> {t('bulk.dialects')}
    </button>
    <button type="button" class="bar-button" onclick={event => open('sources', event)}>
      <IconMdiBookOpenVariant /> {t('bulk.sources')}
    </button>
    <button type="button" class="bar-button" onclick={event => open('review', event)}>
      <IconMdiFlagOutline /> {t('bulk.review')}
    </button>

    <div class="divider"></div>

    <button type="button" class="bar-button danger" onclick={bulk_delete}>
      <IconMdiTrashCanOutline /> {t('misc.delete')}
    </button>

    <button type="button" class="bar-button clear" title={t('bulk.clear')} onclick={() => selection.clear()}>
      <IconMdiClose />
    </button>
  </div>
{/if}

{#if open_picker && picker_anchor}
  <Popover anchor={picker_anchor} on_close={() => open_picker = null} max_width="18rem">
    <div class="picker">
      {#if open_picker === 'tags'}
        {#each $dictionary_tags as tag (tag.id)}
          <div class="picker-row">
            <span class="picker-name">{tag.name}</span>
            <button type="button" class="mini" title={t('bulk.add_to_selected')} onclick={() => bulk_tag({ tag_id: tag.id })}><IconMdiPlus /></button>
            <button type="button" class="mini" title={t('bulk.remove_from_selected')} onclick={() => bulk_tag({ tag_id: tag.id, remove: true })}><IconMdiMinus /></button>
          </div>
        {/each}
        <form
          class="new-tag"
          onsubmit={(event) => {
            event.preventDefault()
            bulk_create_tag()
          }}>
          <input type="text" placeholder={t('bulk.new_tag')} bind:value={new_tag_name} />
          <button type="submit" class="mini" title={t('bulk.add_to_selected')}><IconMdiPlus /></button>
        </form>
      {:else if open_picker === 'dialects'}
        {#each $dictionary_dialects as dialect (dialect.id)}
          <div class="picker-row">
            <span class="picker-name">{dialect.name.default}</span>
            <button type="button" class="mini" title={t('bulk.add_to_selected')} onclick={() => bulk_dialect({ dialect_id: dialect.id })}><IconMdiPlus /></button>
            <button type="button" class="mini" title={t('bulk.remove_from_selected')} onclick={() => bulk_dialect({ dialect_id: dialect.id, remove: true })}><IconMdiMinus /></button>
          </div>
        {/each}
      {:else if open_picker === 'sources'}
        {#each $sources || [] as source (source.id)}
          <div class="picker-row">
            <span class="picker-name">{source.abbreviation || source.citation || source.slug}</span>
            <button type="button" class="mini" title={t('bulk.add_to_selected')} onclick={() => bulk_add_source(source.slug)}><IconMdiPlus /></button>
          </div>
        {/each}
      {:else if open_picker === 'review'}
        {#each Object.entries(review_category_labels) as [category, label] (category)}
          <button type="button" class="picker-action" onclick={() => bulk_review(category)}>{label}</button>
        {/each}
        <button type="button" class="picker-action danger" onclick={() => bulk_review(null)}>{t('bulk.clear_review')}</button>
      {/if}
    </div>
  </Popover>
{/if}

<style>
  .bulk-bar {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    max-width: calc(100vw - 1rem);
    overflow-x: auto;
    padding: 0.375rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 20%);
    background: var(--surface);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
  }

  .bulk-bar.busy {
    opacity: 0.6;
    pointer-events: none;
  }

  .count {
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0 0.375rem;
    white-space: nowrap;
  }

  .divider {
    width: 1px;
    align-self: stretch;
    background: color-mix(in srgb, var(--color) 15%, transparent);
    margin: 0 0.125rem;
  }

  .bar-button {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--color);
    font-size: 0.8125rem;
    white-space: nowrap;
    cursor: pointer;
  }

  .bar-button:hover {
    background: color-mix(in srgb, var(--color) 7%, transparent);
  }

  .bar-button.active {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
  }

  .bar-button.danger {
    color: var(--danger);
  }

  .bar-button.clear {
    padding: 0.375rem;
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  .picker-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.375rem;
    border-radius: 0.5rem;
  }

  .picker-row:hover {
    background: color-mix(in srgb, var(--color) 5%, transparent);
  }

  .picker-name {
    flex: 1 1 0%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
  }

  .mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    border: none;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color) 6%, transparent);
    color: var(--color-secondary);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .mini:hover {
    background: color-mix(in srgb, var(--primary) 18%, transparent);
    color: var(--primary);
  }

  .picker-action {
    padding: 0.375rem 0.5rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--color);
    font-size: 0.8125rem;
    text-align: start;
    cursor: pointer;
  }

  .picker-action:hover {
    background: color-mix(in srgb, var(--color) 7%, transparent);
  }

  .picker-action.danger {
    color: var(--danger);
  }

  .new-tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid color-mix(in srgb, var(--color) 10%, transparent);
  }

  .new-tag input {
    flex: 1 1 0%;
    min-width: 0;
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
  }
</style>
