<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import sanitize from 'xss';

  export let value: string;
  export let field: EntryFieldValue;
  export let bcp: string = undefined;
  export let display: string;
  export let canEdit = false;
  export let on_update: (new_value: string) => void;
</script>

{#if value || canEdit}
  <ShowHide let:show let:set let:toggle>
    <div
      class="md:px-2 rounded {$$props.class}"
      on:click={() => set(canEdit)}
      class:hover:bg-gray-100={canEdit}
      class:cursor-pointer={canEdit}
      class:order-2={!value}>
      {#if field != 'lexeme'}
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
