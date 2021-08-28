<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  import Button from '$svelteui/ui/Button.svelte';
  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: { field: string; newValue: string };
  }>();

  export let value = '',
    field: string,
    display = $_('misc.edit', { default: 'Edit' });

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
</script>

<Modal on:close>
  <span slot="heading">{display}</span>
  <form on:submit|preventDefault={save}>
    <div>
      <!-- <label for="email" class="block text-sm font-medium leading-5 text-gray-700">Email</label> -->
      <div class="rounded-md shadow-sm">
        <!-- svelte-ignore a11y-autofocus -->
        <input
          dir="ltr"
          type="text"
          required={field === 'lx'}
          autofocus
          bind:value
          class:sompeng={display === 'Sompeng-Mardir'}
          class="form-input block w-full" />
      </div>
    </div>

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$_('misc.cancel', { default: 'Cancel' })}
      </Button>
      <Button type="submit" form="primary">
        {$_('misc.save', { default: 'Save' })}
      </Button>
    </div>
  </form>
</Modal>
