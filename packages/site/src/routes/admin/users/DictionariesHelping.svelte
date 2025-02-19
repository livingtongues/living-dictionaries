<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces'

  export let dictionaries: DictionaryView[]
  export let dictionary_ids: string[]
  export let remove_dictionary: (dictionary_id: string) => Promise<void>
  export let add_dictionary: (dictionary_id: string) => Promise<void>
</script>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={dictionary_ids}
    canEdit
    addMessage="Add"
    on:itemclicked={e => window.open(`/${e.detail.value}`, '_blank')}
    on:itemremoved={async e => await remove_dictionary(e.detail.value)}
    on:additem={toggle} />
  {#if show}
    {#await import('./SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
      <SelectDictionaryModal {dictionaries} {add_dictionary} on_close={toggle} />
    {/await}
  {/if}
</ShowHide>
