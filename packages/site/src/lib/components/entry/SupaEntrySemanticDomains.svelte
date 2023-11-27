<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface';
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte';

  export let semanticDomainKeys: string[];
  export let writeInSemanticDomains: string[];
  export let canEdit = false;
  export let showPlus = true;

  const dispatch = createEventDispatcher<{
    update: string[];
    updateWriteIn: string[];
  }>();

  $: translated_semantic_domain_options = semanticDomains.map((domain) => ({
    value: domain.key,
    name: $page.data.t({ dynamicKey: 'sd.' + domain.key, fallback: domain.name }),
  })) as SelectOption[];

  function deleteWriteIn(domain: string) {
    if (!confirm($page.data.t('misc.delete') + '?')) return
    dispatch('updateWriteIn', writeInSemanticDomains.filter((d) => d !== domain))
  }
</script>

<ModalEditableArray
  values={semanticDomainKeys || []}
  options={translated_semantic_domain_options}
  {canEdit}
  {showPlus}
  placeholder={$page.data.t('entry_field.semantic_domains')}
  on:update>
  <span slot="heading">{$page.data.t('entry.select_semantic_domains')}</span>
  <svelte:fragment slot="additional">
    {#each writeInSemanticDomains || [] as domain}
      <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1 whitespace-nowrap flex items-center">
        <i>{domain}</i>
        {#if canEdit}
          <button
            type="button"
            class="cursor-pointer justify-center items-center flex opacity-50 hover:opacity-100 rounded-full h-4 w-4 ml-1"
            title="Remove"
            on:click|stopPropagation={() => deleteWriteIn(domain)}>
            <span class="i-fa-solid-times" />
          </button>
        {/if}
      </div>
      <div class="w-1"></div>
    {/each}
  </svelte:fragment>
  <svelte:fragment slot="plus">
    {#if canEdit && showPlus && !(semanticDomainKeys?.length || writeInSemanticDomains?.length)}
      <span class="i-fa-solid-plus opacity-40 my-1" />
    {/if}
  </svelte:fragment>
</ModalEditableArray>

