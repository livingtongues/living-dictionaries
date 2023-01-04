<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');

  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import type { IEntry } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  export let entry: IEntry;
  let domains = entry.sdn || [];
  let removedDeprecated = false;

  function save() {
    dispatch('valueupdate', {
      field: 'sdn',
      newValue: domains,
    });
    entry.sdn = domains;

    if (removedDeprecated) {
      dispatch('valueupdate', {
        field: 'sd',
        newValue: null,
      });
      entry.sd = null;
    }
    close();
  }
</script>

<Modal on:close>
  <span slot="heading"
    >{$_('entry.select_semantic_domains', {
      default: 'Select Semantic Domains',
    })}:
    {entry.lx}
  </span>

  <form on:submit|preventDefault={save}>
    <MultiSelect bind:value={domains} placeholder={$_('entry.sdn', { default: 'Semantic Domain' })}>
      <option />
      {#each semanticDomains as domain}
        <option value={domain.key}>
          {$_('sd.' + domain.key, { default: domain.name })}
        </option>
      {/each}
    </MultiSelect>

    {#if entry.sd && !removedDeprecated}
      <div class="flex flex-wrap items-center mt-1">
        <div class="text-sm text-gray-600 mr-1 italic">Deprecated:</div>
        <div
          class="items-center flex rounded-lg px-2 py-1 whitespace-nowrap
            text-sm font-medium leading-4 bg-blue-100 text-blue-800 mr-2 my-1">
          <span>{entry.sd.join(', ')}</span>
          <div
            class="cursor-pointer justify-center items-center flex bg-blue-300
              hover:bg-blue-400 rounded-full h-4 w-4 ml-1"
            title="Remove"
            on:click={() => (removedDeprecated = true)}>
            <i class="far fa-times fa-sm" />
          </div>
        </div>
      </div>
    {/if}
    <div class="min-h-[50vh]" />

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$_('misc.cancel', { default: 'Cancel' })}
      </Button>

      <Button type="submit" form="filled">
        {$_('misc.save', { default: 'Save' })}
      </Button>
    </div>
  </form>
</Modal>
