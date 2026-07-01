<script lang="ts">
  import type { Tables } from '$lib/types'
  import EntryField from './EntryField.svelte'
  import { page } from '$app/state'
  import { get_orthographies } from '$lib/helpers/orthographies'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'

  interface Props {
    glossingLanguages: string[]
    sentence: Partial<Tables<'sentences'>>
    can_edit?: boolean
    sense_id: string
  }

  const {
    glossingLanguages,
    sentence,
    can_edit = false,
    sense_id,
  }: Props = $props()

  const { dbOperations } = $derived(page.data)

  const orthographies = $derived(get_orthographies(page.data.dictionary ?? {}))
</script>

<div class:at-end={!sentence.id} class="sentence-col">
  {#if can_edit && sentence.id}
    <button
      type="button"
      class="delete-sentence"
      title={page.data.t('sentence.delete')}
      onclick={() => dbOperations.delete_sentence(sentence.id)}>
      <IconSystemUiconsTrash class="icon-inline" style="font-size: 1.25rem" />
    </button>
  {/if}

  {#each orthographies.all as orthography (orthography.code)}
    <EntryField
      value={sentence.text?.[orthography.code]}
      field="example_sentence"
      {can_edit}
      bcp={orthography.bcp}
      display={orthography.primary
        ? page.data.t('entry_field.example_sentence')
        : `${orthography.name}: ${page.data.t('entry_field.example_sentence')}`}
      on_update={(new_value) => {
        if (!sentence.id) {
          dbOperations.insert_sentence({
            sentence: { text: { [orthography.code]: new_value } },
            sense_id,
          })
        } else {
          dbOperations.update_sentence({
            text: { ...(sentence.text || {}), [orthography.code]: new_value },
            id: sentence.id,
          })
        }
      }} />
  {/each}

  {#if sentence.id}
    {#each glossingLanguages as bcp (bcp)}
      <EntryField
        value={sentence.translation?.[bcp]}
        field="example_sentence"
        {bcp}
        {can_edit}
        display="{page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {page.data.t('entry_field.example_sentence')}"
        on_update={(new_value) => {
          dbOperations.update_sentence({
            translation: {
              ...(sentence.translation || {}),
              [bcp]: new_value,
            },
            id: sentence.id,
          })
        }} />
    {/each}
  {/if}
</div>

<style>
  .sentence-col {
    display: flex;
    flex-direction: column;
  }

  .at-end {
    order: 2;
  }

  .delete-sentence {
    align-self: flex-end;
    color: color-mix(in srgb, var(--color) 45%, var(--background)); /* ≈ gray-400 */
  }

  .delete-sentence:hover {
    color: rgb(239 68 68); /* red-500 */
  }
</style>
