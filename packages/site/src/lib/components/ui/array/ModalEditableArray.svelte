<script lang="ts">
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import { Button, Modal, ShowHide } from 'svelte-pieces';
  import MultiSelect from './MultiSelect.svelte';
  import type { SelectOption } from './select-options.interface';

  const dispatch = createEventDispatcher<{ update: string[] }>();

  export let values: string[];
  export let options: SelectOption[];
  export let placeholder: string;
  export let canEdit = false;
  export let showPlus = true;
  export let canWriteIn = false;

  let selectedOptions: Record<string, SelectOption> = {};
  $: prepareSelected(values, options);

  function prepareSelected(values: string[], options: SelectOption[]) {
    selectedOptions = (values || []).reduce((accumlator, value) => {
      const option = options.find((option) => option.value === value);
      accumlator[value] = option || { value, name: value };
      return accumlator;
    }, {});
  }
</script>

<ShowHide let:show let:set let:toggle>
  <div
    class:cursor-pointer={canEdit}
    class:hover:bg-gray-100={canEdit}
    class="w-full"
    on:click={() => set(canEdit)}>
    <div class="flex flex-wrap whitespace-nowrap" on:click={() => set(canEdit)}>
      {#each Object.values(selectedOptions) as { name }}
        <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1">
          {name}
        </div>
        <div class="w-1" />
      {/each}
      <slot name="additional" />
      <slot name="plus">
        {#if canEdit && showPlus && !values?.length}
          <span class="i-fa-solid-plus opacity-40 my-1" />
        {/if}
      </slot>
    </div>
  </div>

  {#if show}
    <Modal noscroll on:close={() => {
      prepareSelected(values, options);
      toggle();
    }}>
      <span slot="heading"><slot name="heading">Select</slot></span>

      <form on:submit={() => {
        dispatch('update', Object.keys(selectedOptions));
        toggle();
      }}>
        <MultiSelect bind:selectedOptions {options} {placeholder} {canWriteIn} />
        <div class="min-h-[50vh]" />

        <div class="modal-footer space-x-1">
          <Button onclick={() => {
            prepareSelected(values, options);
            toggle();
          }} form="simple" color="black">
            {$t('misc.cancel', { default: 'Cancel' })}
          </Button>

          <Button type="submit"
            form="filled">
            {$t('misc.save', { default: 'Save' })}
          </Button>
        </div>
      </form>

    </Modal>
  {/if}
</ShowHide>