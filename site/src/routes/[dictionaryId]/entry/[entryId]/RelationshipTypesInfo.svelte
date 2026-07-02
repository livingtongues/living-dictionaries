<script lang="ts">
  import type { TranslationKeys } from '$lib/i18n/types'
  import { page } from '$app/state'
  import Modal from '$lib/svelte-pieces/Modal.svelte'
  import { RELATIONSHIP_TYPES } from '$lib/constants'

  interface Props {
    on_close: () => void
  }

  const { on_close }: Props = $props()

  const slugs = Object.keys(RELATIONSHIP_TYPES) as (keyof typeof RELATIONSHIP_TYPES)[]
</script>

<Modal {on_close}>
  {#snippet heading()}
    {page.data.t('relationship_type.related_entries')}
  {/snippet}

  <p class="intro">{page.data.t('relationship_type.help_intro')}</p>

  <div class="type-list">
    {#each slugs as slug (slug)}
      <div class="type-row">
        <!-- Dynamic keys are real en.json entries (RELATIONSHIP_TYPES ⊂ relationship_type.*). -->
        <div class="type-name">{page.data.t(`relationship_type.${slug}` as TranslationKeys)}</div>
        <div class="type-description">{page.data.t(`relationship_type.${slug}_description` as TranslationKeys)}</div>
      </div>
    {/each}
  </div>

  <p class="custom-note">{page.data.t('relationship_type.custom_types_note')}</p>
</Modal>

<style>
  .intro {
    color: var(--color-secondary);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .type-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  .type-row {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .type-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .type-description {
    color: var(--color-secondary);
    font-size: 0.8rem;
  }

  .custom-note {
    color: var(--color-secondary);
    font-size: 0.8rem;
    margin-top: 0.75rem;
  }
</style>
