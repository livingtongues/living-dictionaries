<script module lang="ts">
  let last_selected_speaker_id: string
</script>

<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    select_speaker?: (speaker_id: string) => Promise<void>
    initialSpeakerId?: string
    children?: import('svelte').Snippet<[any]>
  }

  const { select_speaker = undefined, initialSpeakerId = undefined, children }: Props = $props()

  const { speakers } = $derived($page.data)

  const addSpeaker = 'AddSpeaker'
  // Must be $state (not $derived) so `bind:value` on the speaker <select> can write to it —
  // a $derived is not writable, which silently broke speaker selection (and thus audio/video
  // upload). Initialized once from the prop, matching the pre-runes `let` semantics.
  let speaker_id = $state(initialSpeakerId || last_selected_speaker_id)

  function autofocus(node: HTMLSelectElement) {
    setTimeout(() => node.focus(), 5)
  }
</script>

{#if !speaker_id}
  <div class="select-prompt">
    {$page.data.t('audio.select_speaker')}
  </div>
{/if}

{#if !$speakers?.length}
  <Button onclick={() => speaker_id = addSpeaker} form="filled"><IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" /> {$page.data.t('misc.add')}</Button>
{:else}
  <div class="speaker-row">
    <label for="speaker">
      {$page.data.t('entry_field.speaker')}
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
      class="form-input speaker-select">
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
        {$page.data.t('misc.add')}
      </option>
    </select>
  </div>
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
{:else if speaker_id}
  {@render children?.({ speaker_id })}
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
</style>
