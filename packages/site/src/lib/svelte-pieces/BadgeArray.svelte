<script lang="ts">
  import type { Snippet } from 'svelte'
  import Badge from './Badge.svelte'
  import Button from './Button.svelte'
  import DetectUrl from './DetectUrl.svelte'

  interface Props {
    strings?: string[]
    canEdit?: boolean
    promptMessage?: string
    addMessage?: string
    onvalueupdated?: (strings: string[]) => void
    add?: Snippet<[{ add: () => void }]>
    class?: string
  }

  let {
    strings = $bindable([]),
    canEdit = false,
    promptMessage = '',
    addMessage = 'Add',
    onvalueupdated = undefined,
    add: add_snippet = undefined,
    class: classes = '',
  }: Props = $props()

  $effect(() => {
    if (typeof strings === 'string') {
      strings = [strings]
    }
  })

  function add() {
    const string = prompt(promptMessage)
    if (!string) return
    strings = [...(strings || []), string.trim()]
    onvalueupdated?.(strings)
  }

  function remove(index: number) {
    strings.splice(index, 1)
    strings = strings
    onvalueupdated?.(strings)
  }
</script>

<div class="flex flex-wrap {classes}">
  {#if canEdit}
    {#if strings}
      {#each strings as string, i}
        <DetectUrl {string}>
          {#snippet children({ display, href })}
            <Badge
              {href}
              class="mb-1"
              target="_blank"
              onx={() => remove(i)}>
              {display}
            </Badge>
            <div class="w-1"></div>
          {/snippet}
        </DetectUrl>
      {/each}
    {/if}
    {#if add_snippet}
      {@render add_snippet({ add })}
    {:else}
      <Button
        class="mb-1"
        onclick={add}
        color="orange"
        size="sm">
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
