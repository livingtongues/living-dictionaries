<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import EntryField from './EntryField.svelte'
  import { page } from '$app/stores'

  export let glossingLanguages: string[]
  export let sentence: Partial<Tables<'sentences'>>
  export let can_edit = false
  export let sense_id: string

  $: ({ dbOperations } = $page.data)

  const writing_systems = ['default']
</script>

<div class:order-2={!sentence.id} class="flex flex-col">
  {#each writing_systems as orthography}
    <EntryField
      value={sentence.text[orthography]}
      field="example_sentence"
      {can_edit}
      display={$page.data.t('entry_field.example_sentence')}
      on_update={(new_value) => {
        sentence.text[orthography] = new_value
        if (!sentence.id) {
          dbOperations.insert_sentence({
            sentence: { text: { [orthography]: new_value } },
            sense_id,
          })
        } else {
          dbOperations.update_sentence({
            sentence: { text: { [orthography]: new_value } },
            sentence_id: sentence.id,
          })
        }
      }} />
  {/each}

  {#if sentence.id}
    {#each glossingLanguages as bcp}
      <EntryField
        value={sentence.translation?.[bcp]}
        field="example_sentence"
        {bcp}
        {can_edit}
        display="{$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {$page.data.t('entry_field.example_sentence')}"
        on_update={(new_value) => {
          sentence.translation = {
            ...sentence.translation,
            [bcp]: new_value,
          }
          dbOperations.update_sentence({
            sentence: { translation: sentence.translation },
            sentence_id: sentence.id,
          })
        }} />
    {/each}
  {/if}
</div>
