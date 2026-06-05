<script lang="ts">
  import type { Snippet } from 'svelte'
  import IconPlus from '~icons/fa-solid/plus'
  import IconTimes from '~icons/fa-solid/times'

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

  const url_regex = /(((https?:\/\/)|(www\.))[^\s>]+\w\/?)/g

  function prepare_display(value: string) {
    return url_regex.test(value) ? value.replace(/https?:\/\//, '') : value
  }

  function prepare_href(value: string): string | null {
    const match = value?.match(url_regex)
    return match?.length ? match[0].replace(/^www\./, 'http://') : null
  }

  function add() {
    const value = prompt(promptMessage)
    if (!value) return
    strings = [...(strings || []), value.trim()]
    onvalueupdated?.(strings)
  }

  function remove(index: number) {
    strings.splice(index, 1)
    strings = strings
    onvalueupdated?.(strings)
  }
</script>

<div class={['badge-array', classes]}>
  {#if strings}
    {#each strings as string, index (index)}
      {@const href = prepare_href(string)}
      <svelte:element
        this={href ? 'a' : 'div'}
        class="badge"
        href={href || undefined}
        target={href ? '_blank' : undefined}
        rel={href ? 'noopener noreferrer' : undefined}>
        {prepare_display(string)}
        {#if canEdit}
          <button type="button" class="badge-x" aria-label="Remove" onclick={(e) => { e.preventDefault(); remove(index) }}>
            <IconTimes style="font-size: 0.625rem" />
          </button>
        {/if}
      </svelte:element>
    {/each}
  {/if}
  {#if canEdit}
    {#if add_snippet}
      {@render add_snippet({ add })}
    {:else}
      <button type="button" class="btn btn-sm" style="gap: 0.375rem" onclick={add}>
        <IconPlus />
        {addMessage}
      </button>
    {/if}
  {/if}
</div>

<style>
  .badge-array {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: color-mix(in srgb, transparent, var(--primary) 14%);
    color: var(--color);
    text-decoration: none;
  }
  .badge-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1rem;
    width: 1rem;
    border: none;
    border-radius: 9999px;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }
  .badge-x:hover {
    background: color-mix(in srgb, transparent, var(--primary) 25%);
    color: var(--color);
  }
</style>
