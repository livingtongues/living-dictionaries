<script lang="ts">
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import { Button, Modal } from 'svelte-pieces';
  
  const dispatch = createEventDispatcher<{
    close: boolean, 
    update: string[],
    removeCustomDomain: boolean,
  }>();
  const close = () => dispatch('close');

  export let write_in_semantic_domains: string[];
  export let ld_semantic_domains_keys: string[];
  let domains = ld_semantic_domains_keys || [];
  let removeCustomDomain = false;

  function save() {
    dispatch('update', domains);

    if (removeCustomDomain) {
      dispatch('removeCustomDomain');
    }
    close();
  }
</script>

<Modal on:close>
  <span slot="heading">{$t('entry.select_semantic_domains', {
      default: 'Select Semantic Domains',
    })}
  </span>

  <form on:submit|preventDefault={save}>
    <MultiSelect bind:value={domains} placeholder={$t('entry.sdn', { default: 'Semantic Domain' })}>
      <option />
      {#each semanticDomains as domain}
        <option value={domain.key}>
          {$t('sd.' + domain.key, { default: domain.name })}
        </option>
      {/each}
    </MultiSelect>

    {#if write_in_semantic_domains && !removeCustomDomain}
      <div class="flex flex-wrap items-center mt-1">
        <div class="text-sm text-gray-600 mr-1 italic">Deprecated:</div>
        <div
          class="items-center flex rounded-lg px-2 py-1 whitespace-nowrap
            text-sm font-medium leading-4 bg-blue-100 text-blue-800 mr-2 my-1">
          <span>{write_in_semantic_domains.join(', ')}</span>
          <div
            class="cursor-pointer justify-center items-center flex bg-blue-300
              hover:bg-blue-400 rounded-full h-4 w-4 ml-1"
            title="Remove"
            on:click={() => (removeCustomDomain = true)}>
            <i class="far fa-times fa-sm" />
          </div>
        </div>
      </div>
    {/if}
    <div class="min-h-[50vh]" />

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$t('misc.cancel', { default: 'Cancel' })}
      </Button>

      <Button type="submit" form="filled">
        {$t('misc.save', { default: 'Save' })}
      </Button>
    </div>
  </form>
</Modal>
