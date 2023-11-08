<script lang="ts">
  import { Doc } from 'sveltefirets';
  import type { IAbout, IDictionary } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import { Button } from 'svelte-pieces';
  import sanitize from 'xss';

  export let dictionary: IDictionary;
  let aboutType: IAbout;

  function truncateString(str, num) {
    if (str.length <= num)
      return str;

    return str.slice(0, num).trim() + '...';
  }
</script>

<div>
  <div class="mb-2">
    <h2 class="text-3xl font-semibold">{dictionary.name}</h2>
    {#if dictionary.alternateNames?.length}
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
      {dictionary.glossLanguages.map((bcp) => $page.data.t({dynamicKey: 'gl.' + bcp, fallback: bcp})).join(', ')}
    </div>
  {/if}

  {#if dictionary.entryCount}
    <span
      class="mb-2 mr-2 inline-flex items-center px-2 py-1 rounded-full
        text-xs font-medium leading-4 bg-gray-200 text-gray-800">
      {$page.data.t('dictionary.entries')}:&nbsp;
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
      {$page.data.t('home.open_dictionary')}
    </Button>
  {:else}
    <Doc
      path={`dictionaries/${dictionary.id}/info/about`}
      startWith={aboutType}
      let:data={{ about }}>
      <div class="mb-2 text-sm inline-children-elements">
        {@html sanitize(truncateString(about, 200))}
        {#if about.length > 200}
          <a class="hover:underline" href={dictionary.id + '/about'}>
            {$page.data.t('home.read_more')}
          </a>
        {/if}
      </div>
    </Doc>
    <Button class="mt-1 w-full" form="filled" color="black" href={dictionary.id}>
      {$page.data.t('home.open_dictionary')}
      <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1" />
    </Button>
  {/if}
</div>

<style>
  :global(.inline-children-elements *) {
    display: inline;
  }
</style>
