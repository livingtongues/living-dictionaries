<script lang="ts">
  export let value: string,
    updatedValue: string,
    htmlValue: string,
    field: string,
    canEdit = false;
  export let display: string;

  let edit = false;
</script>

<div
  class:cursor-pointer={canEdit}
  class="h-full"
  style="padding: 0.1em 0.25em"
  on:click={() => {
    if (canEdit) {
      edit = true;
    }
  }}>
  {@html updatedValue || htmlValue || value || ''}
  &nbsp;
</div>

{#if edit}
  {#await import('$lib/components/modals/EditFieldModal.svelte') then EditFieldModal}
    <EditFieldModal.default
      on:valueupdate
      value={updatedValue !== undefined ? updatedValue : value}
      {display}
      {field}
      on:close={() => {
        edit = false;
      }} />
  {/await}
{/if}
