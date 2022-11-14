<script lang="ts">
  import { _ } from 'svelte-i18n';

  export let value: string,
    canEdit = false;
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
  {value || ''}
</div>

{#if edit}
  {#await import('$lib/components/modals/DialectModal.svelte') then DialectModal}
    <DialectModal.default
      t={_}
      attribute="di"
      on:valueupdate
      {value}
      on:close={() => {
        edit = false;
      }} />
  {/await}
{/if}