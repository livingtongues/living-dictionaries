<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import sanitize from 'xss'

  let { value, field, bcp = undefined, display, can_edit = false, on_update, class: class_prop = '' }: {
    value: string
    field: EntryFieldValue
    bcp?: string
    display: string
    can_edit?: boolean
    on_update: (new_value: string) => void
    class?: string
  } = $props()
</script>

{#if value || can_edit}
  <ShowHide let:show let:set let:toggle>
    <div
      class="md:px-2 rounded {class_prop}"
      onclick={() => set(can_edit)}
      class:hover:bg-gray-100={can_edit}
      class:cursor-pointer={can_edit}
      class:order-2={!value}>
      {#if field !== 'lexeme'}
        <div class="text-xs text-gray-500 mt-1">{display}</div>
      {/if}
      <div
        class:sompeng={display === 'Sompeng'}
        class:font-bold={field === 'lexeme'}
        class:text-4xl={field === 'lexeme'}
        class:border-b-2={field !== 'lexeme'}
        class="border-dashed pb-1 mb-2">
        {#if value}
          <div dir="ltr">
            {#if field === 'notes' || value.includes('<i>')}
              <span class="tw-prose">
                {@html sanitize(value)}
              </span>
            {:else if field === 'phonetic'}
              [{value}]
            {:else if field === 'scientific_names' && !value?.includes('<i>')}
              <i>{value}</i>
            {:else}
              {value}
            {/if}
          </div>
        {:else}<span class="i-fa6-solid-pencil opacity-40 text-sm" />{/if}
      </div>
    </div>
    {#if show}
      {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
        <EditFieldModal {on_update} {value} {field} {display} {bcp} on_close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
