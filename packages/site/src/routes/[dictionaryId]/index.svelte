<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    return { status: 307, redirect: `/${params.dictionaryId}/entries/list` };
  };
</script>

<script lang="ts">
  import { dictionary, entries, admin } from '$lib/stores';

  function downloadObjectAsJson(exportObj, exportName) {
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', exportName + '.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
</script>

<div>
  Overview is still under construction. You can view the overview of this dictionary on the
  <a
    href="https://talking-dictionaries-prod.web.app/{$dictionary.id}"
    class="underline"
    target="_blank">
    old site
  </a>
  until we have feature parity on the new site you're using here.
  <div class="my-3 text-gray-700 text-sm">
    All content copyright
    <a class="underline" href={'/' + $dictionary.id + '/contributors'}>
      {#if $dictionary.copyright}
        {$dictionary.copyright}
      {:else}{$dictionary.name} community{/if}
    </a>
    ({new Date().getFullYear()})
  </div>
</div>

<!-- {#if $admin > 1}
  <button type="button" on:click={() => downloadObjectAsJson($entries, $dictionary.name)}>
    Download Entries
  </button>

  <pre>{JSON.stringify($dictionary, null, 2)}</pre>
  <pre>{JSON.stringify($entries, null, 2)}</pre>
{/if} -->
