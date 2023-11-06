<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { EntryFields, type ExpandedSense } from '@living-dictionaries/types';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface';
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte';

  export let sense: ExpandedSense;
  export let canEdit = false;
  export let showPlus = true;

  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: EntryFields.semantic_domains | 'sd';
      newValue: string[];
    };
  }>();

  $: translated_semantic_domain_options = semanticDomains.map((domain) => ({
    value: domain.key,
    name: $page.data.t({ dynamicKey: 'sd.' + domain.key, fallback: domain.name }),
  })) as SelectOption[];
</script>

<ModalEditableArray
  values={sense?.ld_semantic_domains_keys || []}
  options={translated_semantic_domain_options}
  {canEdit}
  {showPlus}
  placeholder={$page.data.t('entry.sdn')}
  on:update={({ detail: newValue }) => {
    dispatch('valueupdate', {
      field: EntryFields.semantic_domains,
      newValue,
    });
  }}>
  <span slot="heading">{$page.data.t('entry.select_semantic_domains')}</span>
  <svelte:fragment slot="additional">
    {#each sense?.write_in_semantic_domains || [] as domain}
      <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1 whitespace-nowrap flex items-center">
        <i>{domain}</i>
        {#if canEdit}
          <button
            type="button"
            class="cursor-pointer justify-center items-center flex opacity-50 hover:opacity-100 rounded-full h-4 w-4 ml-1"
            title="Remove"
            on:click|stopPropagation={() => {
              if (confirm($page.data.t('misc.delete') + '?'))
                dispatch('valueupdate', { field: 'sd', newValue: null })
            }}>
            <span class="i-fa-solid-times" />
          </button>
        {/if}
      </div>
      <div class="w-1"></div>
    {/each}
  </svelte:fragment>
  <svelte:fragment slot="plus">
    {#if canEdit && showPlus && !(sense?.ld_semantic_domains_keys?.length || sense?.write_in_semantic_domains?.length)}
      <span class="i-fa-solid-plus opacity-40 my-1" />
    {/if}
  </svelte:fragment>
</ModalEditableArray>

