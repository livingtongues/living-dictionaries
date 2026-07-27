<script lang="ts">
  interface Props {
    /** Characters this dictionary's writing systems registered (see `Orthography.characters`). */
    characters: string[]
    /** Called with the tapped character — the caller splices it in at the caret. */
    on_select: (character: string) => void
    /** Accessible name for the row. */
    label?: string
  }

  const { characters, on_select, label = 'Special characters' }: Props = $props()
</script>

{#if characters.length}
  <div class="character-row" role="group" aria-label={label}>
    {#each characters as character (character)}
      <!-- Keeps focus (and the caret) in the search input: the mousedown default
           would blur it before the click lands. -->
      <button
        type="button"
        class="character"
        aria-label={character}
        onmousedown={event => event.preventDefault()}
        onclick={() => on_select(character)}>
        {character}
      </button>
    {/each}
  </div>
{/if}

<style>
  .character-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .character {
    min-width: 1.875rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.375rem;
    background-color: var(--surface);
    color: var(--color);
    font-size: 1rem;
    line-height: 1.5;
    transition: background-color var(--transition-time, 150ms), transform 75ms;
  }

  .character:hover {
    background-color: color-mix(in srgb, var(--surface), var(--color) 12%);
  }

  .character:active {
    transform: scale(0.93);
  }
</style>
