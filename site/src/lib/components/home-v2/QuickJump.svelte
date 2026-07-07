<script lang="ts">
  import type { DictionaryWithRoles } from '$lib/dictionaries'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { get_visited_dicts } from '$lib/state/visited-dicts'

  interface Props {
    my_dictionaries: DictionaryWithRoles[]
  }

  const { my_dictionaries }: Props = $props()
  const t = $derived(page.data.t)

  const VISIBLE = 3

  interface Pill {
    id: string
    url: string
    name: string
  }

  let visited = $state<Pill[]>([])
  onMount(() => {
    visited = get_visited_dicts()
  })

  const own = $derived(my_dictionaries.map(dictionary => ({ id: dictionary.id, url: dictionary.url ?? dictionary.id, name: dictionary.name })))
  const pills = $derived(own.length ? own : visited)
  const label = $derived(own.length ? t('home.my_dictionaries') : t('home_v2.recently_viewed'))

  let expanded = $state(false)
  const shown = $derived(expanded ? pills : pills.slice(0, VISIBLE))
</script>

{#if pills.length}
  <div class="quick-jump">
    <span class="label">{label}:</span>
    {#each shown as pill (pill.id)}
      <a class="btn btn-sm pill" href="/{pill.url}">{pill.name}</a>
    {/each}
    {#if !expanded && pills.length > VISIBLE}
      <button type="button" class="btn btn-sm more" onclick={() => expanded = true}>
        {t('home_v2.more_count', { values: { count: String(pills.length - VISIBLE) } })}
      </button>
    {/if}
  </div>
{/if}

<style>
  .quick-jump {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1rem;
  }

  .label {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .pill {
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .more {
    color: var(--color-secondary);
  }
</style>
