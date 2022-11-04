<script lang="ts">
  import type { RefinementListItem } from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';
  import { onMount } from 'svelte';
  import { connectRefinementList } from 'instantsearch.js/es/connectors';
  import type { InstantSearch } from 'instantsearch.js';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import DataList from 'svelte-pieces/ui/DataList.svelte';
  export let value: string,
    adding = false,
    search: InstantSearch,
    attribute: 'di';

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: {
      field: string;
      newValue: string;
    };
  }>();
  const close = () => dispatch('close');

  let items: RefinementListItem[] = [];

  onMount(async () => {
    const customRefinementList = connectRefinementList((params) => {
      ({ items } = params);
    });
    search.addWidgets([
      customRefinementList({
        attribute,
        limit: 70,
        showMoreLimit: 20,
      }),
    ]);
  });

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
    <DataList
      type="search"
      class="form-input w-full leading-none"
      allowAny
      on:selected={(e) => {
          value = e.detail.display;
        }}>
      {#each items as dialect}
        <option>{dialect.value}</option>
      {/each}
    </DataList>
  
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
      {#if adding}
        <Button type="submit" form="filled">
          {t ? $t('misc.next') : 'Next'}
          <i class="far fa-chevron-right rtl-x-flip" />
        </Button>
      {:else}
        <Button type="submit" form="filled">
          {t ? $t('misc.save') : 'Save'}
        </Button>
      {/if}
    </div>
  </form>
</Modal>

