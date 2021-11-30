<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { admin } from '$lib/stores';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry;
</script>

<Modal on:close>
  <span slot="heading"> <i class="far fa-video-plus text-sm" /> {entry.lx} </span>

  <div class="mt-2">
    <div class="mb-3">
      {#if entry}
        {entry.id}
      {/if}
    </div>

    {#if entry.sf}
      <div class="px-1">Video</div>
    {/if}
  </div>

  <div class="modal-footer">
    {#if entry.sf}
      {#if $admin > 1}
        {#await import('$svelteui/data/JSON.svelte') then { default: JSON }}
          <JSON obj={entry} />
          <div class="w-1" />
        {/await}
      {/if}
    {/if}
    <Button onclick={close} color="black">
      {$_('misc.close', { default: 'Close' })}
    </Button>
  </div>
</Modal>
