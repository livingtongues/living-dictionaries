<script module lang="ts">
  let last_selected_speaker_id: string
  let last_selected_source_slug: string
</script>

<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { page } from '$app/state'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    select_speaker?: (speaker_id: string) => Promise<void>
    /** Re-attribute existing media to a source (a `sources.slug`). */
    select_source?: (source_slug: string) => Promise<void>
    initialSpeakerId?: string
    initial_source_slug?: string
    children?: import('svelte').Snippet<[any]>
  }

  const { select_speaker = undefined, select_source = undefined, initialSpeakerId = undefined, initial_source_slug = undefined, children }: Props = $props()

  const { speakers, sources } = $derived(page.data)

  const addSpeaker = 'AddSpeaker'
  const addSource = 'AddSource'
  // Must be $state (not $derived) so `bind:value` on the speaker <select> can write to it —
  // a $derived is not writable, which silently broke speaker selection (and thus audio/video
  // upload). Initialized once from the prop, matching the pre-runes `let` semantics.
  // Falls back to '' (never undefined) — an undefined bind:value lets the browser's own
  // selection win at CSR mount, which could land on the "+ Add" option and pop the modal.
  let speaker_id = $state(initialSpeakerId || (initial_source_slug ? '' : last_selected_speaker_id) || '')
  let source_slug = $state(initial_source_slug || '')
  // The speaker-less attribution path: cite a sources-registry entry instead.
  let citing_source = $state(!!initial_source_slug && !initialSpeakerId)

  function autofocus(node: HTMLSelectElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

{#if citing_source}
  {#if !source_slug}
    <div class="select-prompt">
      {page.data.t({ dynamicKey: 'source.select_source', fallback: 'Source of this recording' })}
    </div>
  {/if}

  {#if !$sources?.length}
    <HeadlessButton class="btn-primary btn-default" onclick={() => source_slug = addSource}><IconFaSolidPlus style="margin-top: -0.25rem" /> {page.data.t('misc.add')}</HeadlessButton>
  {:else}
    <div class="speaker-row">
      <label for="source">
        {page.data.t({ dynamicKey: 'source.source', fallback: 'Source' })}
      </label>
      <select
        use:autofocus
        bind:value={source_slug}
        onchange={() => {
          if (source_slug && source_slug !== addSource) {
            last_selected_source_slug = source_slug
            select_source?.(source_slug)
          }
        }}
        class="speaker-select">
        {#if !source_slug}
          <option></option>
        {/if}
        {#each $sources as source (source.id)}
          <option value={source.slug}>
            {source.abbreviation || source.citation || source.slug}
          </option>
        {/each}
        <option value={addSource}>
          +
          {page.data.t('misc.add')}
        </option>
      </select>
    </div>
  {/if}

  <button type="button" class="switch-mode" onclick={() => { citing_source = false; source_slug = '' }}>
    {page.data.t({ dynamicKey: 'source.choose_speaker_instead', fallback: 'Know the speaker? Choose a speaker instead' })}
  </button>
{:else}
  {#if !speaker_id}
    <div class="select-prompt">
      {page.data.t('audio.select_speaker')}
    </div>
  {/if}

  {#if !$speakers?.length}
    <HeadlessButton class="btn-primary btn-default" onclick={() => speaker_id = addSpeaker}><IconFaSolidPlus style="margin-top: -0.25rem" /> {page.data.t('misc.add')}</HeadlessButton>
  {:else}
    <div class="speaker-row">
      <label for="speaker">
        {page.data.t('entry_field.speaker')}
      </label>
      <select
        use:autofocus
        bind:value={speaker_id}
        onchange={() => {
          // Currently means you can't remove a speaker
          if (speaker_id && speaker_id !== addSpeaker) {
            last_selected_speaker_id = speaker_id
            select_speaker?.(speaker_id)
          }
        }}
        class="speaker-select">
        {#if !speaker_id}
          <option></option>
        {/if}
        {#each $speakers as speaker (speaker.id)}
          <option value={speaker.id}>
            {speaker.name}
          </option>
        {/each}
        <option value={addSpeaker}>
          +
          {page.data.t('misc.add')}
        </option>
      </select>
    </div>
  {/if}

  {#if !speaker_id}
    <button type="button" class="switch-mode" onclick={() => { citing_source = true; speaker_id = ''; source_slug = source_slug || last_selected_source_slug || '' }}>
      {page.data.t({ dynamicKey: 'source.cite_instead', fallback: 'Speaker unknown? Cite a source instead' })}
    </button>
  {/if}
{/if}

{#if speaker_id === addSpeaker}
  {#await import('$lib/components/media/AddSpeaker.svelte') then { default: AddSpeaker }}
    <AddSpeaker
      on_close={() => speaker_id = ''}
      on_speaker_added={(new_speaker_id) => {
        speaker_id = new_speaker_id
        select_speaker?.(new_speaker_id)
      }} />
  {/await}
{:else if source_slug === addSource}
  {#await import('$lib/components/sources/EditSource.svelte') then { default: EditSource }}
    <EditSource
      on_close={() => { if (source_slug === addSource) source_slug = '' }}
      on_saved={({ slug }) => {
        source_slug = slug
        last_selected_source_slug = slug
        select_source?.(slug)
      }} />
  {/await}
{:else if speaker_id}
  {@render children?.({ speaker_id, source_slug: undefined })}
{:else if citing_source && source_slug}
  {@render children?.({ speaker_id: undefined, source_slug })}
{/if}

<style>
  .select-prompt {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-bottom: 0.5rem;
  }

  .speaker-row {
    display: flex;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
    margin-bottom: 1rem;
  }

  label {
    display: inline-flex;
    align-items: center;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    background-color: color-mix(in srgb, var(--background), var(--color) 2%); /* ≈ gray-50 */
    color: var(--color-secondary); /* ≈ gray-500 */
  }

  :global([dir='ltr']) label {
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
  }

  :global([dir='rtl']) label {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }

  .speaker-select {
    display: block;
    width: 100%;
    padding-left: 0.75rem;
    border-radius: 0 !important;
  }

  :global([dir='ltr']) .speaker-select {
    border-top-right-radius: 0.375rem !important;
    border-bottom-right-radius: 0.375rem !important;
  }

  :global([dir='rtl']) .speaker-select {
    border-top-left-radius: 0.375rem !important;
    border-bottom-left-radius: 0.375rem !important;
  }

  .speaker-select:hover {
    outline-color: rgb(37 99 235); /* blue-600 (hover:outline-blue-600 — sets color only, no outline width) */
  }

  .switch-mode {
    display: block;
    font-size: 0.8125rem;
    color: rgb(37 99 235); /* blue-600 */
    margin-bottom: 1rem;
    padding: 0;
    text-align: start;
  }

  .switch-mode:hover {
    text-decoration: underline;
  }
</style>
