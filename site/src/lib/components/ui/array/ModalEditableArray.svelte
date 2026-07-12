<script lang="ts">
  import MultiSelect from './MultiSelect.svelte'
  import type { SelectOption } from './select-options.interface'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    values: string[]
    options: SelectOption[]
    placeholder: string
    can_edit?: boolean
    showPlus?: boolean
    canWriteIn?: boolean
    on_update: (new_value: string[]) => void
    additional?: import('svelte').Snippet
    plus?: import('svelte').Snippet
    heading?: import('svelte').Snippet
  }

  const {
    values,
    options,
    placeholder,
    can_edit = false,
    showPlus = true,
    canWriteIn = false,
    on_update,
    additional,
    plus,
    heading,
  }: Props = $props()

  let selectedOptions: Record<string, SelectOption> = $state({})

  function prepareSelected(values: string[], options: SelectOption[]) {
    selectedOptions = (values || []).reduce((accumlator, value) => {
      const option = options.find(option => option.value === value)
      accumlator[value] = option || { value, name: value }
      return accumlator
    }, {})
  }
  prepareSelected(values, options) // seed once at init (SSR-visible); modal close re-seeds explicitly
  $effect(() => {
    prepareSelected(values, options)
  })

  const heading_render = $derived(heading)
</script>

<ShowHide>
  {#snippet children({ show, set, toggle })}
    <div
      class:editable={can_edit}
      class="value-display"
      onclick={() => set(can_edit)}>
      <div class="chips" onclick={() => set(can_edit)}>
        {#each Object.values(selectedOptions) as { value, name } (value)}
          <div class="chip">
            {name}
          </div>
          <div class="chip-gap"></div>
        {/each}
        {@render additional?.()}
        {#if plus}{@render plus()}{:else}
          {#if can_edit && showPlus && !values?.length}
            <IconFaSolidPlus style="opacity: 0.4; margin-top: 0.25rem; margin-bottom: 0.25rem" />
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
          <span>{#if heading_render}{@render heading_render()}{:else}Select{/if}</span>
        {/snippet}

        <form
          onsubmit={(e) => {
            e.preventDefault()
            on_update(Object.keys(selectedOptions))
            toggle()
          }}>
          <MultiSelect bind:selectedOptions {options} {placeholder} {canWriteIn} />
          <div style="min-height: 50vh"></div>

          <!-- the child gaps (was `space-x-1`) are built into the global .modal-footer rules -->
          <div class="modal-footer">
            <HeadlessButton
              class="btn-ghost btn-default"
              onclick={() => {
                prepareSelected(values, options)
                toggle()
              }}>
              {page.data.t('misc.cancel')}
            </HeadlessButton>

            <HeadlessButton class="btn-primary btn-default" type="submit">
              {page.data.t('misc.save')}
            </HeadlessButton>
          </div>
        </form>

      </Modal>
    {/if}
  {/snippet}
</ShowHide>

<style>
  .value-display {
    width: 100%;
  }

  .editable {
    cursor: pointer;
  }

  .editable:hover {
    background-color: var(--surface); /* ≈ gray-100 */
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    white-space: nowrap;
  }

  .chip {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    line-height: 1.25;
    /* ≈ blue-100 in light; readable tint in dark (matches BadgeArray) */
    background-color: color-mix(in srgb, transparent, var(--primary) 14%);
    color: var(--color);
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .chip-gap {
    width: 0.25rem;
  }
</style>
