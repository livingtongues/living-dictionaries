<script lang="ts">
  import type { RefinementListItem } from 'instantsearch.js/es/connectors/refinement-list/connectRefinementList';
  import { onMount } from 'svelte';
  import { connectRefinementList } from 'instantsearch.js/es/connectors';
  import type { InstantSearch } from 'instantsearch.js';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import type { IEntry } from '@living-dictionaries/types';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import DataList from 'svelte-pieces/ui/DataList.svelte';
  export let entry: IEntry,
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

  interface IRefinementItem extends RefinementListItem {
    translatedLabel?: string;
  }

  //TODO maybe I only need the value and not the entry
  let value = entry.di;
  let items: IRefinementItem[] = [];

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
      field: 'di',
      newValue: value.trim(),
    });
    close();
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5);
  }

  let inputEl: HTMLInputElement;
</script>

<Modal on:close>
  <span slot="heading"
    >{$t('entry.di', {
      default: 'Dialect',
    })}
  </span>

  <form on:submit|preventDefault={save}>
    {#if items.length}
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
    {:else}
      <div class="rounded-md shadow-sm">
        <input
          bind:this={inputEl}
          dir="ltr"
          type="text"
          use:autofocus
          bind:value
          class="form-input block w-full" />
      </div>
    {/if}
  
    <div class="modal-footer">
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

