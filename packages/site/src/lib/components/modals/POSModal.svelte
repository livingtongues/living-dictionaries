<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { createEventDispatcher } from 'svelte';
  import { partsOfSpeech } from '@living-dictionaries/parts';

  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import type { IEntry } from '@living-dictionaries/types';
  export let entry: IEntry;
  let poss = entry.ps || [];

  function save() {
    dispatch('valueupdate', {
      field: 'ps',
      newValue: poss,
    });
    entry.ps = poss;
    close();
  }
</script>

<Modal on:close>
  <span slot="heading"
    >{$_('entry.select_parts_of_speech', {
      default: 'Select Parts of Speech',
    })}:
    {entry.lx}
  </span>

  <form on:submit|preventDefault={save}>
    <MultiSelect bind:value={poss} placeholder={$_('entry.ps', { default: 'Part of Speech' })}>
      {#each partsOfSpeech as pos}
        <option value={pos.enAbbrev}>
          {$_('ps.' + pos.enAbbrev, { default: pos.enAbbrev })}
        </option>
      {/each}
    </MultiSelect>

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