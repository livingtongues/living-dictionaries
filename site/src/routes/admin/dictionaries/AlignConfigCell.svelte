<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'
  import type { AlignConfig } from '$lib/db/schemas/shared.types'
  import Modal from '$lib/components/ui/Modal.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'

  interface Props {
    dictionary: RowType<'dictionaries'>
  }

  const { dictionary }: Props = $props()

  let show_modal = $state(false)
  let primary = $state<string>('token_text')
  let converter = $state('')
  let auto_align = $state(false)

  const config = $derived(dictionary.align_config as AlignConfig | null)
  const summary = $derived(config ? (config.auto_align ? 'auto' : 'manual') : null)

  function open() {
    primary = config?.primary ?? 'token_text'
    converter = config?.converter ?? ''
    auto_align = config?.auto_align ?? false
    show_modal = true
  }

  async function save() {
    dictionary.align_config = {
      primary: primary as AlignConfig['primary'],
      ...(converter.trim() ? { converter: converter.trim() } : {}),
      ...(auto_align ? { auto_align: true } : {}),
    }
    await dictionary._save()
    show_modal = false
  }

  async function clear() {
    if (!confirm('Remove alignment configuration? The Auto-align button disappears for this dictionary.'))
      return
    dictionary.align_config = null
    await dictionary._save()
    show_modal = false
  }
</script>

<button type="button" class={['align-btn', summary]} onclick={open}>
  {summary ?? '—'}
</button>

{#if show_modal}
  <Modal on_close={() => show_modal = false}>
    {#snippet heading()}
      Alignment config — {dictionary.name}
    {/snippet}

    <p class="hint">
      How this dictionary's tokens become MMS align_forms (a–z + apostrophe). Admin-only —
      managers never see this; they just get the Auto-align button once configured.
      Bespoke converters live in <code>$lib/db/server/align/converters.ts</code>.
    </p>

    <label class="field">
      <span>Primary source</span>
      <select bind:value={primary}>
        <option value="token_text">token_text — distill the surface form</option>
        {#each dictionary.orthographies ?? [] as orthography (orthography.code)}
          <option value={`orthography:${orthography.code}`}>orthography: {orthography.name || orthography.code} (linked entry lexeme)</option>
        {/each}
        <option value="phonetic">phonetic — linked entry's phonetic field</option>
      </select>
    </label>

    <label class="field">
      <span>Converter (registry key, optional)</span>
      <input type="text" bind:value={converter} placeholder="none" />
    </label>

    <label class="field checkbox">
      <input type="checkbox" bind:checked={auto_align} />
      <span>auto_align — graduated: align automatically on audio attach</span>
    </label>

    <div class="modal-footer">
      {#if config}
        <HeadlessButton class="btn btn-default" style="color: var(--danger)" onclick={clear}>Remove</HeadlessButton>
        <div style="width: 0.25rem"></div>
      {/if}
      <HeadlessButton class="btn btn-default" onclick={() => show_modal = false}>Cancel</HeadlessButton>
      <div style="width: 0.25rem"></div>
      <HeadlessButton class="btn btn-primary" onclick={save}>Save</HeadlessButton>
    </div>
  </Modal>
{/if}

<style>
  .align-btn {
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.3));
    border-radius: 999px;
    padding: 0.125rem 0.625rem;
    font-size: 0.75rem;
    background: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
  }

  .align-btn.manual {
    color: var(--primary);
    opacity: 1;
  }

  .align-btn.auto {
    color: var(--success);
    opacity: 1;
  }

  .hint {
    font-size: 0.8125rem;
    opacity: 0.75;
    margin-bottom: 1rem;
    max-width: 26rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.875rem;
    font-size: 0.875rem;
  }

  .field.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
</style>
