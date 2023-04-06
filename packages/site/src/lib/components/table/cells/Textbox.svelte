<script lang="ts">
  export let value: string,
    updatedValue: string,
    htmlValue: string,
    field: string,
    canEdit = false,
    display: string;

  let edit = false;
</script>

<div
  class:cursor-pointer={canEdit}
  class:italic={field === 'scn' && !value?.includes('<i>')}
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
  {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
    <EditFieldModal
      on:valueupdate
      value={updatedValue !== undefined ? updatedValue : value}
      {display}
      {field}
      on:close={() => {
        edit = false;
      }} />
  {/await}
{/if}
