<script lang="ts">
  import { stopPropagation } from 'svelte/legacy';

  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'
  import { semanticDomains } from '$lib/mappings/semantic-domains'

  interface Props {
    semantic_domain_keys: string[];
    write_in_semantic_domains: string[];
    can_edit?: boolean;
    show_plus?: boolean;
    on_update: (new_value: string[]) => void;
    on_update_write_in: (new_value: string[]) => void;
  }

  let {
    semantic_domain_keys,
    write_in_semantic_domains,
    can_edit = false,
    show_plus = true,
    on_update,
    on_update_write_in
  }: Props = $props();

  let translated_semantic_domain_options = $derived(semanticDomains.map(domain => ({
    value: domain.key,
    name: $page.data.t({ dynamicKey: `sd.${domain.key}`, fallback: domain.name }),
  })) satisfies SelectOption[])

  function deleteWriteIn(domain: string) {
    if (!confirm(`${$page.data.t('misc.delete')}?`)) return
    on_update_write_in(write_in_semantic_domains.filter(d => d !== domain))
  }
</script>

<ModalEditableArray
  values={semantic_domain_keys || []}
  options={translated_semantic_domain_options}
  {can_edit}
  showPlus={show_plus}
  placeholder={$page.data.t('entry_field.semantic_domains')}
  {on_update}>
  {#snippet heading()}
    <span >{$page.data.t('entry.select_semantic_domains')}</span>
  {/snippet}
  {#snippet additional()}
  
      {#each write_in_semantic_domains || [] as domain}
        <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1 whitespace-nowrap flex items-center">
          <i>{domain}</i>
          {#if can_edit}
            <button
              type="button"
              class="cursor-pointer justify-center items-center flex opacity-50 hover:opacity-100 rounded-full h-4 w-4 ml-1"
              title="Remove"
              onclick={stopPropagation(() => deleteWriteIn(domain))}>
              <span class="i-fa-solid-times"></span>
            </button>
          {/if}
        </div>
        <div class="w-1"></div>
      {/each}
    
  {/snippet}
  {#snippet plus()}
  
      {#if can_edit && show_plus && !(semantic_domain_keys?.length || write_in_semantic_domains?.length)}
        <span class="i-fa-solid-plus opacity-40 my-1"></span>
      {/if}
    
  {/snippet}
</ModalEditableArray>
