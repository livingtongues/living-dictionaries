<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import EntryField from './EntryField.svelte'
  import { page } from '$app/state'

  interface Props {
    glossingLanguages: string[];
    sentence: Partial<Tables<'sentences'>>;
    can_edit?: boolean;
    sense_id: string;
  }

  let {
    glossingLanguages,
    sentence,
    can_edit = false,
    sense_id
  }: Props = $props();

  let { dbOperations } = $derived(page.data)

  const writing_systems = ['default']
</script>

<div class:order-2={!sentence.id} class="flex flex-col">
  {#each writing_systems as orthography}
    <EntryField
      value={sentence.text[orthography]}
      field="example_sentence"
      {can_edit}
      display={page.data.t('entry_field.example_sentence')}
      on_update={(new_value) => {
        if (!sentence.id) {
          dbOperations.insert_sentence({
            sentence: { text: { [orthography]: new_value } },
            sense_id,
          })
        } else {
          dbOperations.update_sentence({
            text: { [orthography]: new_value },
            id: sentence.id,
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
        display="{page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {page.data.t('entry_field.example_sentence')}"
        on_update={(new_value) => {
          dbOperations.update_sentence({
            translation: {
              ...sentence.translation,
              [bcp]: new_value,
            },
            id: sentence.id,
          })
        }} />
    {/each}
  {/if}
</div>
