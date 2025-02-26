<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { BadgeArrayEmit, Button, ShowHide } from 'svelte-pieces'

  export let dictionaries: DictionaryView[]
  export let dictionary_ids: string[]
  export let remove_dictionary: (dictionary_id: string) => Promise<void>
  export let add_dictionary: (dictionary_id: string) => Promise<void>
</script>

<ShowHide let:show={show_all} let:toggle={toggle_all}>
  <ShowHide let:show let:toggle>
    <BadgeArrayEmit
      strings={dictionary_ids.slice(0, show_all ? 1000 : 8)}
      canEdit
      addMessage="Add"
      on:itemclicked={e => window.open(`/${e.detail.value}`, '_blank')}
      on:itemremoved={async e => await remove_dictionary(e.detail.value)}
      on:additem={toggle} />
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
  </ShowHide>
</ShowHide>
