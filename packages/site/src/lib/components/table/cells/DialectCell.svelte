<script lang="ts">
  import { ShowHide } from 'svelte-pieces';

  export let value: string;
  export let canEdit = false;
</script>

<ShowHide let:show let:set let:toggle>
  <div
    class:cursor-pointer={canEdit}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(canEdit)}>
    {value || ''}
  </div>

  {#if show}
    {#await import('$lib/components/modals/DialectModal.svelte') then { default: DialectModal }}
      <DialectModal on:valueupdate {value} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
