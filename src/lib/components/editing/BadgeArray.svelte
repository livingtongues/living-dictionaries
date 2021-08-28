<script lang="ts">
  import Button from '$svelteui/ui/Button.svelte';
  import Badge from '$svelteui/ui/Badge.svelte';
  import DetectUrl from '$svelteui/functions/DetectUrl.svelte';

  export let strings: string[] = [],
    canEdit = false,
    promptMessage: string,
    addMessage: string;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ valueupdated: string[] }>();
</script>

<div class="{$$props.class} flex flex-wrap">
  {#if canEdit}
    {#each strings as string, i}
      <DetectUrl {string} let:display let:href>
        <Badge
          {href}
          class="mb-1"
          target="_blank"
          onx={() => {
            strings.splice(i, 1);
            strings = strings;
            dispatch('valueupdated', strings);
          }}>
          {display}
        </Badge>
        <div class="w-1" />
      </DetectUrl>
    {/each}
    <Button
      class="mb-1"
      onclick={() => {
        const string = prompt(promptMessage);
        if (string) {
          strings = [...strings, string.trim()];
          dispatch('valueupdated', strings);
        }
      }}
      color="orange"
      size="sm">
      <i class="fas fa-plus" />
      {addMessage}
    </Button>
  {:else}
    {#each strings as string}
      <DetectUrl {string} let:display let:href>
        <Badge class="mb-1" {href} target="_blank">
          {display}
        </Badge>
        <div class="w-1" />
      </DetectUrl>
    {/each}
  {/if}
</div>
