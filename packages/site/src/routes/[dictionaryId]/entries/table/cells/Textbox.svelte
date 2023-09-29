<script lang="ts">
  import type { EntryFieldValue } from '@living-dictionaries/types';
  import { ShowHide } from 'svelte-pieces';
  import sanitize from 'xss';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface $$Events {
    update: CustomEvent<string>;
  }

  export let value: string;
  export let htmlValue: string = undefined;
  export let field: EntryFieldValue;
  export let bcp: string = undefined;
  export let canEdit = false;
  export let display: string;

  $: sanitizedHtml = sanitize(htmlValue || value) || '';
</script>

<ShowHide let:show let:toggle let:set>
  <div
    class:cursor-pointer={canEdit}
    class:italic={field === 'scientific_names' && !value?.includes('<i>')}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(canEdit)}>
    {@html sanitizedHtml}
    &nbsp;
  </div>

  {#if show}
    {#await import('$lib/components/entry/EditFieldModal.svelte') then { default: EditFieldModal }}
      <EditFieldModal
        on:update
        {value}
        {field}
        {display}
        {bcp}
        on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
