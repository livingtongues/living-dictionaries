<script lang="ts">
  import { Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import MultiSelect from './MultiSelect.svelte'
  import type { SelectOption } from './select-options.interface'
  import { page } from '$app/state'

  interface Props {
    values: string[];
    options: SelectOption[];
    placeholder: string;
    can_edit?: boolean;
    showPlus?: boolean;
    canWriteIn?: boolean;
    on_update: (new_value: string[]) => void;
    additional?: import('svelte').Snippet;
    plus?: import('svelte').Snippet;
    heading?: import('svelte').Snippet;
  }

  let {
    values,
    options,
    placeholder,
    can_edit = false,
    showPlus = true,
    canWriteIn = false,
    on_update,
    additional,
    plus,
    heading
  }: Props = $props();

  let selectedOptions: Record<string, SelectOption> = $state({})

  function prepareSelected(values: string[], options: SelectOption[]) {
    selectedOptions = (values || []).reduce((accumlator, value) => {
      const option = options.find(option => option.value === value)
      accumlator[value] = option || { value, name: value }
      return accumlator
    }, {})
  }
  $effect(() => {
    prepareSelected(values, options)
  });

  const heading_render = $derived(heading);
</script>

<ShowHide   >
  {#snippet children({ show, set, toggle })}
    <div
      class:cursor-pointer={can_edit}
      class:hover:bg-gray-100={can_edit}
      class="w-full"
      onclick={() => set(can_edit)}>
      <div class="flex flex-wrap whitespace-nowrap" onclick={() => set(can_edit)}>
        {#each Object.values(selectedOptions) as { name }}
          <div class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1">
            {name}
          </div>
          <div class="w-1"></div>
        {/each}
        {@render additional?.()}
        {#if plus}{@render plus()}{:else}
          {#if can_edit && showPlus && !values?.length}
            <span class="i-fa-solid-plus opacity-40 my-1"></span>
          {/if}
        {/if}
      </div>
    </div>

    {#if show}
      <Modal
        noscroll
        on_close={() => {
          prepareSelected(values, options)
          toggle()
        }}>
        {#snippet heading()}
            <span >{#if heading_render}{@render heading_render()}{:else}Select{/if}</span>
          {/snippet}

        <form
          onsubmit={(e) => {
            e.preventDefault()
            on_update(Object.keys(selectedOptions))
            toggle()
          }}>
          <MultiSelect bind:selectedOptions {options} {placeholder} {canWriteIn} />
          <div class="min-h-[50vh]"></div>

          <div class="modal-footer space-x-1">
            <Button
              onclick={() => {
                prepareSelected(values, options)
                toggle()
              }}
              form="simple"
              color="black">
              {page.data.t('misc.cancel')}
            </Button>

            <Button type="submit" form="filled">
              {page.data.t('misc.save')}
            </Button>
          </div>
        </form>

      </Modal>
    {/if}
  {/snippet}
</ShowHide>
