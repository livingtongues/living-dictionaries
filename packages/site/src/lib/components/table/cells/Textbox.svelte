<script lang="ts">
  import { ShowHide } from "svelte-pieces";
  import sanitize from "xss";

  export let value: string;
  export let htmlValue: string = undefined;
  export let field: string;
  export let canEdit = false;
  export let display: string;

  $: html = sanitize(htmlValue || value) || "";
</script>

<ShowHide let:show let:toggle let:set>
  <div
    class:cursor-pointer={canEdit}
    class:italic={field === "scn" && !value?.includes("<i>")}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(canEdit)}
  >
    {@html html}
    &nbsp;
  </div>

  {#if show}
    {#await import("$lib/components/entry/EditFieldModal.svelte") then { default: EditFieldModal }}
      <EditFieldModal
        on:valueupdate
        {value}
        {display}
        {field}
        on:close={toggle}
      />
    {/await}
  {/if}
</ShowHide>
