<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from 'svelte-i18n';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { dictionary } from '$lib/stores';

  export let value: string;
  interface IAlgoliaFacetsQuery {
    facetHits: {
      value: string;
    }[];
    exhaustiveFacetsCount: boolean;
    processingTimeMS: number;
  }

  async function fetchDialects(): Promise<IAlgoliaFacetsQuery> {
    const response = await fetch(
      'https://XCVBAYSYXD.algolia.net/1/indexes/entries_prod/facets/di/query',
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': 'XCVBAYSYXD', // App ID
          'X-Algolia-API-Key': 'e6d98efb32d3dc2435dce7b97ea87c3e', // Public API key
        },
        body: JSON.stringify({
          facetFilters: [[`dictId:${$dictionary.id}`]],
          maxFacetHits: 100, // Algolia max possible https://www.algolia.com/doc/api-reference/api-parameters/maxFacetHits/
        }),
      }
    );
    return await response.json();
  }

  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: {
      field: string;
      newValue: string;
    };
  }>();

  const close = () => dispatch('close');

  function save(newValue: string) {
    dispatch('valueupdate', {
      field: 'di',
      newValue,
    });
    close();
  }
</script>

<Modal on:close>
  <span slot="heading"
    >{$t('entry.di', {
      default: 'Dialect',
    })}
  </span>

  {#await fetchDialects()}
    <span class="i-gg-spinner animate-spin mb-3 block" />
  {:then { facetHits }}
    {#each facetHits as dialect}
      <Button
        onclick={() => save(dialect.value)}
        class="mr-1 mb-1 opacity-100"
        form={value === dialect.value ? 'filled' : 'simple'}
        size="sm">{dialect.value}</Button>
    {/each}
  {:catch error}
    <div class="text-red-500 mb-3">
      Error loading current dialects: {error}
    </div>
  {/await}

  <div class="mb-1">
    <Button
      onclick={() => {
        const value = prompt(
          $t('entry.di', {
            default: 'Dialect',
          })
        );
        if (value) {
          save(value.trim());
        }
      }}
      class="mr-1 mb-1"
      color="orange"
      size="sm"><span class="i-fa-solid-plus" /> {$t('misc.add', { default: 'Add' })}</Button>
  </div>

  <div class="modal-footer">
    {#if value}
      <Button onclick={() => save(null)} form="simple" color="red">
        {t ? $t('misc.remove') : 'Remove'}
      </Button>
      <div class="w-1" />
    {/if}
    <Button onclick={close} form="simple" color="black">
      {t ? $t('misc.cancel') : 'Cancel'}
    </Button>
  </div>
</Modal>
