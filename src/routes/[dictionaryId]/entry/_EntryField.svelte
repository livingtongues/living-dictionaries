<script lang="ts">
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
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
        class="{field === 'lx' ? 'font-bold text-4xl' : 'border-b-2'} border-dashed pb-1 mb-2">
        {#if value}
          <div dir="ltr">
            {#if value.indexOf('<i>') > -1}
              <!-- prettier-ignore -->
              {#if field === 'ph'}[{/if}{@html value}{#if field === 'ph'}]{/if}
            {:else}
              <!-- prettier-ignore -->
              {#if field === 'ph'}[{/if}{value}{#if field === 'ph'}]{/if}
            {/if}
          </div>
        {:else}<i class="far fa-pencil text-gray-500 text-sm" />{/if}
      </div>
    </div>
    {#if show}
      {#await import('$lib/components/modals/EditFieldModal.svelte') then { default: EditFieldModal }}
        <EditFieldModal on:valueupdate {value} {field} {display} on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
