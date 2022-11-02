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
  export let entry: IEntry,
    adding = false,
    search: InstantSearch,
    attribute: 'di';

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
    // dispatch('valueupdate', {
    //   field,
    //   newValue: value.trim(),
    // });
    // close();
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5);
  }

  let inputEl: HTMLInputElement;
  $: console.log("items:", items)
</script>

<Modal on:close>
  <span slot="heading"
    >{$t('entry.di', {
      default: 'Dialect',
    })}
  </span>

  <form on:submit|preventDefault={save}>
    {#if items.length}
      Select
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

