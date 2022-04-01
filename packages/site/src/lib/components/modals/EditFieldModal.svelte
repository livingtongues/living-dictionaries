<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: { field: string; newValue: string };
  }>();

  export let value = '',
    field: string,
    display = $_('misc.edit', { default: 'Edit' }),
    adding = false;

  function close() {
    dispatch('close');
  }

  function save() {
    dispatch('valueupdate', {
      field,
      newValue: value.trim(),
    });
    close();
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 5);
  }
</script>

<Modal on:close>
  <span slot="heading">{display}</span>
  <form on:submit|preventDefault={save}>
    <div>
      <!-- <label for="email" class="block text-sm font-medium leading-5 text-gray-700">Email</label> -->
      <div class="rounded-md shadow-sm">
        <input
          dir="ltr"
          type="text"
          required={field === 'lx'}
          use:autofocus
          bind:value
          class:sompeng={display === 'Sompeng-Mardir'}
          class="form-input block w-full" />
      </div>
    </div>

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$_('misc.cancel', { default: 'Cancel' })}
      </Button>
      {#if adding}
        <Button type="submit" form="primary">
          {$_('misc.next', { default: 'Next' })}
          <i class="far fa-chevron-right rtl-x-flip" />
        </Button>
      {:else}
        <Button type="submit" form="primary">
          {$_('misc.save', { default: 'Save' })}
        </Button>
      {/if}
    </div>
  </form>
</Modal>
