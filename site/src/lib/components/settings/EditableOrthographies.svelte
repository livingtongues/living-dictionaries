<script lang="ts">
  import type { Orthography, Tables } from '$lib/types'
  import type { KeymanWritingSystems } from '$lib/components/keyboards/keyman/writing-systems'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/LegacyModal.svelte'
  import { page } from '$app/state'
  import Filter from '$lib/components/Filter.svelte'
  import { get_orthographies } from '$lib/helpers/orthographies'
  import { additionalKeyboards, glossingLanguages } from '$lib/glosses/glossing-languages'
  import { is_reserved_or_known_code, load_keyman_writing_systems } from '$lib/components/keyboards/keyman/writing-systems'
  import IconFa6SolidChevronUp from '~icons/fa6-solid/chevron-up'
  import IconFa6SolidChevronDown from '~icons/fa6-solid/chevron-down'
  import IconFa6SolidTrash from '~icons/fa6-solid/trash'
  import IconFa6SolidKeyboard from '~icons/fa6-solid/keyboard'

  interface Props {
    dictionary: Tables<'dictionaries'>
    on_update: (orthographies: Orthography[]) => Promise<void>
  }
  const { dictionary, on_update }: Props = $props()

  const registry = $derived(get_orthographies(dictionary))

  interface WritingSystemOption { bcp: string, name: string, keyboard: boolean }
  const base_options: WritingSystemOption[] = [
    ...Object.entries(glossingLanguages).map(([bcp, lang]) => ({ bcp, name: lang.vernacularName || bcp, keyboard: !!lang.internalName })),
    ...Object.entries(additionalKeyboards).map(([bcp, lang]) => ({ bcp, name: lang.vernacularName || bcp, keyboard: true })),
  ]
  let keyman_writing_systems = $state<KeymanWritingSystems>()
  const options = $derived.by(() => {
    const result = [...base_options]
    if (keyman_writing_systems) {
      const known: Record<string, true> = {}
      for (const option of base_options) known[option.bcp] = true
      for (const [bcp, system] of Object.entries(keyman_writing_systems))
        if (!known[bcp]) result.push({ bcp, name: system.name, keyboard: true })
    }
    return result
  })

  // 'new' → append a new alternate; 'primary' → set the primary's writing system.
  let picker_target = $state<'new' | 'primary' | null>(null)
  let custom_code = $state('')

  function commit(next: { primary: Orthography, alternates: Orthography[] }) {
    const primary_configured = !!(next.primary.name?.trim() || next.primary.bcp || next.primary.notes)
    const primary_entry: Orthography = { code: 'default', name: next.primary.name?.trim() || '', primary: true }
    if (next.primary.bcp) primary_entry.bcp = next.primary.bcp
    if (next.primary.notes) primary_entry.notes = next.primary.notes
    const orthographies = [...(primary_configured ? [primary_entry] : []), ...next.alternates]
    return on_update(orthographies)
  }

  function rename(code: string, name: string) {
    if (code === registry.primary.code)
      return commit({ primary: { ...registry.primary, name }, alternates: registry.alternates })
    return commit({ primary: registry.primary, alternates: registry.alternates.map(orthography => orthography.code === code ? { ...orthography, name } : orthography) })
  }

  function move(index: number, direction: -1 | 1) {
    const alternates = [...registry.alternates]
    const target = index + direction
    if (target < 0 || target >= alternates.length) return
    ;[alternates[index], alternates[target]] = [alternates[target], alternates[index]]
    return commit({ primary: registry.primary, alternates })
  }

  async function usage_count(code: string): Promise<number> {
    const { dict_db } = page.data
    if (!dict_db) return 0
    const entries = await dict_db.entries.query({ where: `lexeme IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(lexeme) WHERE key = ? AND value IS NOT NULL AND value != '')`, params: [code] }).snapshot()
    const sentences = await dict_db.sentences.query({ where: `text IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(text) WHERE key = ? AND value IS NOT NULL AND value != '')`, params: [code] }).snapshot()
    return entries.length + sentences.length
  }

  async function remove(orthography: Orthography) {
    const count = await usage_count(orthography.code)
    if (count > 0) {
      alert(`“${orthography.name || orthography.code}” is used by ${count} entr${count === 1 ? 'y' : 'ies'}/sentence(s). Clear it from those first.`)
      return
    }
    if (!confirm(`Delete the “${orthography.name || orthography.code}” orthography?`)) return
    await commit({ primary: registry.primary, alternates: registry.alternates.filter(other => other.code !== orthography.code) })
  }

  function open_picker(target: 'new' | 'primary') {
    picker_target = target
    custom_code = ''
    load_keyman_writing_systems().then((systems) => { keyman_writing_systems = systems })
  }

  function choose_option(option: WritingSystemOption) {
    if (picker_target === 'primary') {
      commit({ primary: { ...registry.primary, name: registry.primary.name || option.name, bcp: option.bcp }, alternates: registry.alternates })
    } else if (!registry.alternates.some(orthography => orthography.code.toLowerCase() === option.bcp.toLowerCase())) {
      commit({ primary: registry.primary, alternates: [...registry.alternates, { code: option.bcp, name: option.name, bcp: option.bcp }] })
    }
    picker_target = null
  }

  function add_custom() {
    const code = custom_code.trim()
    if (!code) return
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/i.test(code)) {
      alert('Use letters, numbers and hyphens (a BCP-47 tag or a slug).')
      return
    }
    if (is_reserved_or_known_code(code, keyman_writing_systems)) {
      alert(`“${code}” is a known writing system or reserved — pick it from the list above so its keyboard is set up.`)
      return
    }
    if (registry.alternates.some(orthography => orthography.code.toLowerCase() === code.toLowerCase())) {
      alert(`“${code}” already exists.`)
      return
    }
    commit({ primary: registry.primary, alternates: [...registry.alternates, { code, name: '' }] })
    picker_target = null
  }
</script>

<div class="section-title">{page.data.t('entry_field.local_orthography')}</div>
<div class="hint">The primary headword is always first. Add more writing systems for the same words.</div>

<div class="ortho-list">
  <div class="ortho-row primary-row">
    <span class="badge">1</span>
    <input
      class="name-input"
      placeholder={page.data.t('entry_field.lexeme')}
      value={registry.primary.name}
      onchange={event => rename(registry.primary.code, (event.target as HTMLInputElement).value)} />
    <button type="button" class="kb-button" class:has-kb={!!registry.primary.bcp} title="Writing system / keyboard" onclick={() => open_picker('primary')}>
      <IconFa6SolidKeyboard class="icon-inline" />
      {registry.primary.bcp || 'set'}
    </button>
  </div>

  {#each registry.alternates as orthography, index (orthography.code)}
    <div class="ortho-row">
      <span class="badge">{index + 2}</span>
      <input
        class="name-input"
        placeholder={orthography.code}
        value={orthography.name}
        onchange={event => rename(orthography.code, (event.target as HTMLInputElement).value)} />
      <span class="code-tag" title="immutable code">{orthography.code}</span>
      <button type="button" class="icon-button" title="Move up" disabled={index === 0} onclick={() => move(index, -1)}>
        <IconFa6SolidChevronUp class="icon-inline" />
      </button>
      <button type="button" class="icon-button" title="Move down" disabled={index === registry.alternates.length - 1} onclick={() => move(index, 1)}>
        <IconFa6SolidChevronDown class="icon-inline" />
      </button>
      <button type="button" class="icon-button danger" title="Delete" onclick={() => remove(orthography)}>
        <IconFa6SolidTrash class="icon-inline" />
      </button>
    </div>
  {/each}
</div>

<Button form="menu" size="sm" onclick={() => open_picker('new')}>+ {page.data.t('misc.add')}</Button>

{#if picker_target}
  <Modal on:close={() => (picker_target = null)}>
    {#snippet heading()}
      <span>{picker_target === 'primary' ? 'Primary writing system' : 'Add a writing system'}</span>
    {/snippet}
    <Filter items={options} placeholder={page.data.t('about.search')}>
      {#snippet children({ filteredItems }: { filteredItems: WritingSystemOption[] })}
        <div class="option-list">
          {#each filteredItems.slice(0, 60) as option (option.bcp)}
            <Button form="simple" color="green" class="ws-option" onclick={() => choose_option(option)}>
              <span>{option.name}</span>
              <span class="ws-bcp">{option.bcp}{option.keyboard ? ' ⌨' : ''}</span>
            </Button>
          {/each}
        </div>
      {/snippet}
    </Filter>

    <div class="custom-row">
      <input class="name-input" placeholder="or a custom code (e.g. village-spelling)" bind:value={custom_code} />
      <Button form="filled" size="sm" onclick={add_custom}>Add custom</Button>
    </div>

    <div class="modal-footer">
      <Button onclick={() => (picker_target = null)} color="black">{page.data.t('misc.cancel')}</Button>
    </div>
  </Modal>
{/if}

<style>
  .section-title {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
    margin-bottom: 0.25rem;
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background));
    margin-bottom: 0.5rem;
  }

  .ortho-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .ortho-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .badge {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    border-radius: 9999px;
    background-color: var(--surface);
    color: var(--color-secondary);
  }

  .primary-row .badge {
    background-color: color-mix(in srgb, var(--primary, #2563eb) 15%, var(--background));
    color: var(--primary, #2563eb);
    font-weight: 700;
  }

  .name-input {
    flex-grow: 1;
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 18%);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    color: var(--color);
  }

  .code-tag {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-family: monospace;
    color: var(--color-secondary);
    padding: 0 0.25rem;
  }

  .icon-button,
  .kb-button {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
    border-radius: 0.25rem;
    color: var(--color-secondary);
  }

  .kb-button {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    border: 1px dashed color-mix(in srgb, var(--background), var(--color) 25%);
  }

  .kb-button.has-kb {
    border-style: solid;
    color: var(--color);
  }

  .icon-button:hover {
    background-color: var(--surface);
  }

  .icon-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-button.danger:hover {
    color: #dc2626;
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-height: 40vh;
    overflow-y: auto;
  }

  :global(.ws-option) {
    width: 100%;
    display: flex !important;
    justify-content: space-between !important;
    text-align: left !important;
  }

  .ws-bcp {
    font-family: monospace;
    font-size: 0.7rem;
    opacity: 0.6;
  }

  .custom-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.75rem;
  }
</style>
