<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'
  import Badge from './Badge.svelte'
  import DetectUrl from './DetectUrl.svelte'

  interface Props {
    strings?: string[]
    canEdit?: boolean
    addMessage?: string
    minimum?: number
    onitemclicked?: (detail: { value: string, index: number }) => void
    onitemremoved?: (detail: { value: string, index: number }) => void
    onadditem?: () => void
    add?: Snippet
    class?: string
  }

  let {
    strings = $bindable([]),
    canEdit = false,
    addMessage = 'Add',
    minimum = 0,
    onitemclicked = undefined,
    onitemremoved = undefined,
    onadditem = undefined,
    add: add_snippet = undefined,
    class: classes = '',
  }: Props = $props()

  $effect(() => {
    if (typeof strings === 'string') {
      strings = [strings]
    }
  })
</script>

<div class="flex flex-wrap {classes}">
  {#if canEdit}
    {#if strings}
      {#each strings as string, index}
        <DetectUrl {string}>
          {#snippet children({ display, href })}
            <Badge
              {href}
              class="mb-1"
              target="_blank"
              onclick={() => onitemclicked?.({ value: string, index })}
              onx={strings.length > minimum
                ? () => onitemremoved?.({ value: string, index })
                : undefined}>
              {display}
            </Badge>
            <div class="w-1"></div>
          {/snippet}
        </DetectUrl>
      {/each}
    {/if}
    {#if add_snippet}
      {@render add_snippet()}
    {:else}
      <Button class="mb-1" onclick={() => onadditem?.()} color="orange" size="sm">
        <span class="i-fa-solid-plus"></span>
        {addMessage}
      </Button>
    {/if}
  {:else if strings}
    {#each strings as string}
      <DetectUrl {string}>
        {#snippet children({ display, href })}
          <Badge class="mb-1" {href} target="_blank">
            {display}
          </Badge>
          <div class="w-1"></div>
        {/snippet}
      </DetectUrl>
    {/each}
  {/if}
</div>
