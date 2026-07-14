<script lang="ts">
  import { page } from '$app/state'
  import { TAG_KINDS } from '$lib/constants'
  import type { TagKind } from '$lib/constants'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import IconMdiClose from '~icons/mdi/close'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    text_id: string
    can_edit?: boolean
  }

  const { text_id, can_edit = false }: Props = $props()

  const { t, dict_db, writes } = $derived(page.data)

  const linked_tag_ids = $derived(new Set((dict_db?.text_tags.rows ?? [])
    .filter(link => link.text_id === text_id)
    .map(link => link.tag_id)))

  const tags = $derived((dict_db?.tags.rows ?? [])
    .filter(tag => linked_tag_ids.has(tag.id)))

  // Existing kinded tags in this dictionary — reuse suggestions (dedupe by row).
  const kinded_tags = $derived((dict_db?.tags.rows ?? []).filter(tag => !!tag.kind))

  let adding = $state(false)
  let new_kind = $state<TagKind>('motif')
  let new_name = $state('')
  let new_code = $state('')

  const suggestions = $derived.by(() => {
    const query = new_name.trim().toLowerCase()
    if (!query) return []
    return kinded_tags
      .filter(tag => tag.kind === new_kind && !linked_tag_ids.has(tag.id) && (tag.name || '').toLowerCase().includes(query))
      .slice(0, 5)
  })

  function kind_label(kind: string | null): string {
    return kind ? t({ dynamicKey: `text_tag.${kind}`, fallback: kind }) : ''
  }

  async function add() {
    const name = new_name.trim()
    if (!name) return
    await writes.assign_text_tag({ text_id, name, kind: new_kind, code: new_code.trim() || undefined })
    new_name = ''
    new_code = ''
  }

  async function attach_existing(tag: DictRowType<'tags'>) {
    await writes.assign_text_tag({ text_id, name: tag.name, kind: tag.kind as TagKind, code: tag.code ?? undefined })
    new_name = ''
    new_code = ''
  }

  async function remove(tag_id: string) {
    await writes.remove_text_tag({ text_id, tag_id })
  }
</script>

<div class="text-tags">
  {#if tags.length}
    <div class="chips">
      {#each tags as tag (tag.id)}
        <span class="chip" data-kind={tag.kind}>
          <span class="chip-kind">{kind_label(tag.kind)}</span>
          <span class="chip-name">{tag.name}</span>
          {#if tag.code}<span class="chip-code">{tag.code}</span>{/if}
          {#if can_edit}
            <button type="button" class="chip-remove" aria-label={t('text_tag.remove')} onclick={() => remove(tag.id)}>
              <IconMdiClose />
            </button>
          {/if}
        </span>
      {/each}
    </div>
  {/if}

  {#if can_edit}
    {#if adding}
      <div class="add-form">
        <select class="kind-select" bind:value={new_kind}>
          {#each TAG_KINDS as kind (kind)}
            <option value={kind}>{kind_label(kind)}</option>
          {/each}
        </select>
        <div class="name-wrap">
          <input
            type="text"
            class="name-input"
            bind:value={new_name}
            placeholder={t('text_tag.name')}
            onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
          {#if suggestions.length}
            <div class="suggestions">
              {#each suggestions as tag (tag.id)}
                <button type="button" class="suggestion" onclick={() => attach_existing(tag)}>
                  {tag.name}{#if tag.code}<span class="suggestion-code">{tag.code}</span>{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <input type="text" class="code-input" bind:value={new_code} placeholder={t('text_tag.code')} />
        <button type="button" class="btn-primary btn-sm" disabled={!new_name.trim()} onclick={add}>{t('text_tag.add')}</button>
        <button type="button" class="btn-outline btn-sm" onclick={() => adding = false}>{t('misc.cancel')}</button>
      </div>
    {:else}
      <button type="button" class="add-tag" onclick={() => adding = true}>
        <IconFaSolidPlus /> {t('text_tag.add')}
      </button>
    {/if}
  {/if}
</div>

<style>
  .text-tags {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    background: color-mix(in srgb, var(--primary) 10%, var(--background));
    color: var(--color);
  }

  .chip-kind {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-secondary);
  }

  .chip-code {
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
  }

  .chip-remove {
    display: inline-flex;
    align-items: center;
    padding: 0;
    color: var(--color-secondary);
  }

  .chip-remove:hover {
    color: var(--danger);
  }

  .add-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .kind-select,
  .name-input,
  .code-input {
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.875rem;
  }

  .name-wrap {
    position: relative;
  }

  .code-input {
    width: 8rem;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.125rem;
    z-index: 10;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
  }

  .suggestion {
    text-align: left;
    padding: 0.375rem 0.5rem;
    background: transparent;
    color: var(--color);
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .suggestion:hover {
    background: var(--surface);
  }

  .suggestion-code {
    color: var(--color-secondary);
  }

  .add-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    align-self: flex-start;
    padding: 0.25rem 0.5rem;
    border: 1px dashed var(--border-color);
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .add-tag:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
</style>
