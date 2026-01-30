<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { BadgeArrayEmit, Button, ShowHide } from '$lib/svelte-pieces'

  interface Props {
    dictionaries: DictionaryView[];
    dictionary_ids: string[];
    remove_dictionary: (dictionary_id: string) => Promise<void>;
    add_dictionary: (dictionary_id: string) => Promise<void>;
  }

  let {
    dictionaries,
    dictionary_ids,
    remove_dictionary,
    add_dictionary
  }: Props = $props();
</script>

<ShowHide  >
  {#snippet children({ show: show_all, toggle: toggle_all })}
    <ShowHide  >
      {#snippet children({ show, toggle })}
        <BadgeArrayEmit
          strings={dictionary_ids.slice(0, show_all ? 1000 : 8)}
          canEdit
          addMessage="Add"
          onitemclicked={({ value }) => window.open(`/${value}`, '_blank')}
          onitemremoved={async ({ value }) => await remove_dictionary(value)}
          onadditem={toggle} />
        {#if dictionary_ids.length > 8}
          <Button
            color="black"
            onclick={toggle_all}
            size="sm"
            form="simple">{show_all ? 'Show less' : `Show all ${dictionary_ids.length}`}</Button>
        {/if}
        {#if show}
          {@const dictionaries_not_already_editing = dictionaries.filter(({ id }) => !dictionary_ids.includes(id))}
          {#await import('./SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
            <SelectDictionaryModal dictionaries={dictionaries_not_already_editing} {add_dictionary} on_close={toggle} />
          {/await}
        {/if}
            {/snippet}
    </ShowHide>
  {/snippet}
</ShowHide>
