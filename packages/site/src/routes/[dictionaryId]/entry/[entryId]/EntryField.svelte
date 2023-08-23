<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import sanitize from 'xss';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface $$Events {
    update: CustomEvent<string>;
  }

  export let value: string;
  export let field: EntryFieldValue;
  export let bcp: string = undefined;
  export let display: string;
  export let canEdit = false;
</script>

{#if value || canEdit}
  <ShowHide let:show let:set let:toggle>
    <div
      class="md:px-2 rounded"
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
        <EditFieldModal on:update {value} {field} {display} {bcp} on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
