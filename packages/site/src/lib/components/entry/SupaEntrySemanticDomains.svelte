<script lang="ts">
  import { page } from '$app/stores';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface';
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte';

  export let semantic_domain_keys: string[];
  export let write_in_semantic_domains: string[];
  export let can_edit = false;
  export let show_plus = true;
  export let on_update: (new_value: string[]) => void;
  export let on_update_write_in: (new_value: string[]) => void;

  $: translated_semantic_domain_options = semanticDomains.map((domain) => ({
    value: domain.key,
    name: $page.data.t({ dynamicKey: 'sd.' + domain.key, fallback: domain.name }),
  })) as SelectOption[];

  function deleteWriteIn(domain: string) {
    if (!confirm($page.data.t('misc.delete') + '?')) return
    on_update_write_in(write_in_semantic_domains.filter((d) => d !== domain))
  }
</script>

<ModalEditableArray
  values={semantic_domain_keys || []}
  options={translated_semantic_domain_options}
  canEdit={can_edit}
  showPlus={show_plus}
  placeholder={$page.data.t('entry_field.semantic_domains')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry.select_semantic_domains')}</span>
  <svelte:fragment slot="additional">
    {#each write_in_semantic_domains || [] as domain}
      <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1 whitespace-nowrap flex items-center">
        <i>{domain}</i>
        {#if can_edit}
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
    {#if can_edit && show_plus && !(semantic_domain_keys?.length || write_in_semantic_domains?.length)}
      <span class="i-fa-solid-plus opacity-40 my-1" />
    {/if}
  </svelte:fragment>
</ModalEditableArray>

