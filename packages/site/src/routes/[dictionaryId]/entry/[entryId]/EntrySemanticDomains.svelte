<script lang="ts">
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import type { ExpandedSense } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import { semanticDomains } from '$lib/mappings/semantic-domains';

  export let sense: ExpandedSense;
  export let canEdit = false;

  const dispatch = createEventDispatcher<{
    removeCustomDomain: boolean;
  }>();

  $: hasValue = sense.translated_ld_semantic_domains?.length || sense.write_in_semantic_domains?.length;

  $: translated_semantic_domains = semanticDomains.map((domain) => ({
    key: domain.key,
    name: $t('sd.' + domain.key, { default: domain.name }),
  }));
</script>

{#if hasValue || canEdit}
  <ShowHide let:show let:set let:toggle>
    <div
      class:hover:bg-gray-100={canEdit}
      class:cursor-pointer={canEdit}
      class:order-2={!hasValue}
      class="md:px-2 rounded"
      on:click={() => set(canEdit)}>
      <div class="text-xs text-gray-500 my-1">
        {$t('entry.sdn', { default: 'Semantic Domain' })}
      </div>
      <div class="flex flex-wrap whitespace-nowrap border-b-2 mb-2">
        {#if sense.write_in_semantic_domains?.length}
          {#each sense.write_in_semantic_domains as domain}
            <span class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1 whitespace-nowrap flex items-center">
              <i>{domain}</i>
              {#if canEdit}
                <button type="button"
                  class="cursor-pointer justify-center items-center flex opacity-50 hover:opacity-100 rounded-full h-4 w-4 ml-1"
                  title="Remove"
                  on:click|stopPropagation={() => dispatch('removeCustomDomain')}>
                  <span class="i-fa-solid-times" />
                </button>
              {/if}
            </span>

            <div class="w-1" />
          {/each}
        {/if}

        {#if sense.translated_ld_semantic_domains?.length}
          {#each sense.translated_ld_semantic_domains as domain}
            <span class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1">
              {domain}
            </span>
            <div class="w-1" />
          {/each}
        {/if}
        {#if !hasValue}
          <span class="i-fa6-solid-pencil text-gray-500 text-sm mb-2" />
        {/if}
      </div>
    </div>

    {#if show}
      {#await import('$lib/components/entry/MultiSelectModal.svelte') then { default: MultiSelectModal }}
        <MultiSelectModal
          on:update
          value={[...sense.ld_semantic_domains_keys || []]}
          placeholder={$t('entry.sdn', { default: 'Semantic Domain' })}
          options={translated_semantic_domains}
          on:close={toggle}>
          <span slot="heading"
          >{$t('entry.select_semantic_domains', {
            default: 'Select Semantic Domains',
          })}
        </MultiSelectModal>
      {/await}
    {/if}
  </ShowHide>
{/if}

