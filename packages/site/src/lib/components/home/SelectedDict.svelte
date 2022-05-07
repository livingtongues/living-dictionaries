<script lang="ts">
  import { Doc } from '$sveltefirets';
  import type { IAbout, IDictionary } from '@living-dictionaries/types';

  import { _ } from 'svelte-i18n';
  import Button from 'svelte-pieces/ui/Button.svelte';
  export let dictionary: IDictionary;
  let aboutType: IAbout;

  function truncateString(str, num) {
    if (str.length <= num) {
      return str;
    }
    return str.slice(0, num).trim() + '...';
  }
</script>

<div>
  <div class="mb-2">
    <h2 class="text-3xl font-semibold">{dictionary.name}</h2>
    {#if dictionary.alternateNames && dictionary.alternateNames.length}
      <div class="text-gray-600">
        ({dictionary.alternateNames.join(', ')})
      </div>
    {/if}
  </div>

  {#if dictionary.location}
    <div class="mb-2">
      <i class="far fa-globe-asia fa-fw" />
      {dictionary.location}
    </div>
  {/if}

  {#if dictionary.glossLanguages}
    <div class="mb-2">
      <i class="far fa-info-circle fa-fw" />
      {dictionary.glossLanguages.map((bcp) => $_('gl.' + bcp)).join(', ')}
    </div>
  {/if}

  {#if dictionary.entryCount}
    <span
      class="mb-2 mr-2 inline-flex items-center px-2 py-1 rounded-full
        text-xs font-medium leading-4 bg-gray-200 text-gray-800">
      {$_('dictionary.entries', { default: 'Entries' })}:&nbsp;
      <b>{dictionary.entryCount}</b>
    </span>
  {/if}

  {#if dictionary.iso6393}
    <span
      style="direction: ltr"
      class="mb-2 mr-2 inline-flex items-center px-2 py-1 rounded-full
        text-xs font-medium leading-4 bg-gray-200 text-gray-800">
      ISO 639-3:&nbsp; <b>{dictionary.iso6393}</b>
    </span>
  {/if}
  {#if dictionary.glottocode}
    <span
      style="direction: ltr"
      class="mb-2 mr-2 inline-flex items-center px-2 py-1 rounded-full
        text-xs font-medium leading-4 bg-gray-200 text-gray-800">
      Glottocode:&nbsp; <b>{dictionary.glottocode}</b>
    </span>
  {/if}

  {#if dictionary.type === 'tdv1'}
    <Button target="_blank" class="mt-1 w-full" form="filled" color="black" href={dictionary.url}>
      {$_('home.open_dictionary', { default: 'Open Dictionary' })}
    </Button>
  {:else}
    <Doc
      path={`dictionaries/${dictionary.id}/info/about`}
      startWith={aboutType}
      let:data={{ about }}>
      <div class="mb-2 text-sm inline-children-elements">
        {@html truncateString(about, 200)}
        {#if about.length > 200}
          <a class="hover:underline" href={dictionary.id + '/about'} sveltekit:prefetch>
            {$_('home.read_more', { default: 'Read More' })}
          </a>
        {/if}
      </div>
    </Doc>
    <Button class="mt-1 w-full" form="filled" color="black" href={dictionary.id}>
      {$_('home.open_dictionary', { default: 'Open Dictionary' })}
      <i class="far fa-chevron-right rtl-x-flip" />
    </Button>
  {/if}
</div>

<style>
  :global(.inline-children-elements *) {
    display: inline;
  }
</style>
