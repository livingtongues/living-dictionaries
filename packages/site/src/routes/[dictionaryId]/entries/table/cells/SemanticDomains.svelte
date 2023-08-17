<script lang="ts">
  // import { t } from 'svelte-i18n';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';

  export let entry: ExpandedEntry;
  export let canEdit = false;
</script>

<ShowHide let:show let:toggle let:set>
  <div
    class:cursor-pointer={canEdit}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(canEdit)}>
    SD_TODO
    <!-- {#if entry.sdn && entry.sdn.length}
      {#each entry.sdn as domain, i}
        {$_('sd.' + domain, { default: domain })}{#if i != entry.sdn.length - 1}
          <span class="mr-1">,</span>
        {/if}
      {/each}
    {/if}
    {#if entry.sdn && entry.sdn.length && entry.sd}|{/if}
    {#if entry.sd}<i class="mr-1">{entry.sd}</i>{/if} -->
    &nbsp;
  </div>

  {#if show}
    {#await import('$lib/components/entry/SemanticDomainsModal.svelte') then { default: SemanticDomainsModal }}
      <SemanticDomainsModal
        {entry}
        on:valueupdate
        on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
