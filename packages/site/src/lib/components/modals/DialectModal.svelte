<script lang="ts">
  import { onMount } from 'svelte';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { dictionary } from '$lib/stores';
  export let value: string,
    attribute: 'di';

interface IAlgoliaFacetsQuery {
  facetHits: {
    value: string;
  }[];
  exhaustiveFacetsCount: boolean;
  processingTimeMS: number;
}

  let data: IAlgoliaFacetsQuery;
  const getData = async () => {
    try {
      const response = await fetch('https://XCVBAYSYXD.algolia.net/1/indexes/entries_prod/facets/di/query', {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': 'XCVBAYSYXD', // App ID
          'X-Algolia-API-Key': 'e6d98efb32d3dc2435dce7b97ea87c3e' // Public API key
        },
        body: JSON.stringify({
          "facetFilters": [
              [
                  `dictId:${$dictionary.id}`
              ]
          ],
          "maxFacetHits": 20
        })
      });
     return await response.json();
    } catch (err) {
      console.error(err);
    }
  };

  onMount(async () => {
    data = await getData();
  });

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: {
      field: string;
      newValue: string;
    };
  }>();
  const close = () => dispatch('close');

  function save() {
    dispatch('valueupdate', {
      field: attribute,
      newValue: value.trim(),
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

  <form on:submit|preventDefault={save}>
    <Button onclick={() => {
      value = prompt($t('entry.di', {
      default: 'Dialect',
    }));
      if (value) {
        save();
      }
    }} class="mr-1 mb-1" color="orange" size="sm"><span class="i-fa-solid-plus" /> {$t('misc.add', {default: 'Add'})}</Button>
    {#if data}    
      {#each data.facetHits as dialect}
        <Button onclick={() => {
          value = dialect.value;
          save();
        }} class="mr-1 mb-1 opacity-100" disabled={value === dialect.value} form={value === dialect.value ? 'filled' : 'simple'} size="sm">{dialect.value}</Button>
      {/each}
    {/if}
  
    <div class="modal-footer">
      {#if value}       
        <Button onclick={() => {value = ''; save()} } form="simple" color="red">
          {t ? $t('misc.remove') : 'Remove'}
        </Button>
      {/if}
      <Button onclick={close} form="simple" color="black">
        {t ? $t('misc.cancel') : 'Cancel'}
      </Button>
      <div class="w-1" />
    </div>
  </form>
</Modal>

