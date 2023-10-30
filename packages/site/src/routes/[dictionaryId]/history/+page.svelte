<script lang="ts">
  import { t } from 'svelte-i18n';
  import { canEdit } from '$lib/stores';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  export let data;
</script>

<div>
  <h3 class="text-xl font-semibold mb-3">
    {$t('dictionary.history', { default: 'History' })}
  </h3>

  {#if canEdit}
    {#if history.length > 0}
      <ul class="m-3 md:text-xl">
        {#each data.history as record}
          {@const { editor, editedLexeme, editedDictionaryId, action, updatedAt } = record}
          <li class="mb-2">{editor} <strong>{action}</strong> <a href="{editedDictionaryId}/{editedLexeme}">{editedLexeme}</a> on {updatedAt.toDate().toLocaleString()}</li>
        {/each}
      </ul>
    {:else}
      <p>History is empty</p>
    {/if}
  {:else}
    Only Managers and contributors can see this.
  {/if}
</div>
