<script lang="ts">
  import type { DictionaryWithRoles } from '$lib/dictionaries'
  import type { MapDict } from './types'
  import HeroSearch from './HeroSearch.svelte'
  import QuickJump from './QuickJump.svelte'

  interface Props {
    dicts: MapDict[]
    my_dictionaries: DictionaryWithRoles[]
  }

  const { dicts, my_dictionaries }: Props = $props()
</script>

<div class="search-row">
  <div class="search-slot">
    <HeroSearch {dicts} />
  </div>
  <QuickJump {my_dictionaries} />
</div>

<style>
  .search-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
  }

  .search-slot {
    flex: 1 1 22rem;
    max-width: 34rem;
    min-width: 0;
  }
</style>
