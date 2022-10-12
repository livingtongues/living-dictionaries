<script lang="ts">
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  export let value: string,
    field: string = undefined,
    display: string,
    canEdit = false;
</script>

{#if value || canEdit}
  <ShowHide let:show let:set let:toggle>
    <div
      class="md:px-2 rounded"
      on:click={() => set(canEdit)}
      class:hover:bg-gray-100={canEdit}
      class:cursor-pointer={canEdit}
      class:order-2={!value}>
      {#if field != 'lx'}
        <div class="text-xs text-gray-500 mt-1">{display}</div>
      {/if}
      <div
        class:sompeng={display === 'Sompeng-Mardir'}
        class:font-bold={field === 'lx'}
        class:text-4xl={field === 'lx'}
        class:border-b-2={field !== 'lx'}
        class="border-dashed pb-1 mb-2">
        {#if value}
          <div dir="ltr">
            {#if field === 'nt' || value.indexOf('<i>') > -1}
              <span class="tw-prose">
                {@html value}
              </span>
            {:else if field === 'ph'}
              [{value}]
            {:else}
              {value}
            {/if}
          </div>
        {:else}<i class="far fa-pencil text-gray-500 text-sm" />{/if}
      </div>
    </div>
    {#if show}
      {#await import('@living-dictionaries/parts/src/lib/entries/EditFieldModal.svelte') then { default: EditFieldModal }}
        <EditFieldModal on:valueupdate {t} {value} {field} {display} on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
