<script lang="ts">
  import { admin } from '$lib/stores';
  import type { IDictionary } from '$lib/interfaces';
  import { printDate } from '$lib/helpers/time';
  export let dictionary: IDictionary;
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import DictionaryFieldEdit from './_DictionaryFieldEdit.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch =
    createEventDispatcher<{ addalternatename: string; removealternatename: string }>();
</script>

<tr title={$admin > 1 && JSON.stringify(dictionary, null, 1)}>
  <td class="italic !text-xs">
    {dictionary.public ? 'Public' : 'Private'}
  </td>
  <td class="italic">
    <DictionaryFieldEdit field={'name'} value={dictionary.name} dictionaryId={dictionary.id} />
  </td>
  <td>
    <DictionaryFieldEdit
      field={'iso6393'}
      value={dictionary.iso6393}
      dictionaryId={dictionary.id} />
  </td>
  <td>
    <DictionaryFieldEdit
      field={'glottocode'}
      value={dictionary.glottocode}
      dictionaryId={dictionary.id} />
  </td>
  <td>
    <ShowHide let:show let:toggle>
      <Button size="sm" form="simple" onclick={toggle}>
        {#if dictionary.coordinates}
          {dictionary.coordinates.latitude}°
          {dictionary.coordinates.latitude < 0 ? 'S' : 'N'},
          {dictionary.coordinates.longitude}°
          {dictionary.coordinates.longitude < 0 ? 'W' : 'E'}
        {:else}<b>Add</b>{/if}
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Coordinates.svelte') then { default: Coordinates }}
          <Coordinates on:close={toggle} {dictionary} on:save on:remove />
        {/await}
      {/if}
    </ShowHide>
  </td>
  <td>
    <DictionaryFieldEdit
      field={'location'}
      value={dictionary.location}
      dictionaryId={dictionary.id} />
  </td>
  <td>
    {dictionary.entryCount || ''}
  </td>
  <td>
    <BadgeArrayEmit addMessage="Add" strings={dictionary.glossLanguages} />
  </td>
  <td>
    <BadgeArrayEmit
      canEdit
      addMessage={'Add'}
      strings={dictionary.alternateNames}
      on:additem={() => {
        const name = prompt('Enter alternate name:');
        if (name) {
          dispatch('addalternatename', name);
        }
      }}
      on:itemremoved={(e) => dispatch('removealternatename', e.detail.value)} />
  </td>
  <td>
    {dictionary.alternateOrthographies || ''}
  </td>
  <td class="whitespace-nowrap">
    {#if dictionary.createdAt}{printDate(dictionary.createdAt.toDate())}{/if}
  </td>
</tr>
