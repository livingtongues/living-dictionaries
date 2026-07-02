<script lang="ts">
  import type { PartnerWithPhoto, Tables } from '$lib/types'
  import { build_citation } from './build-citation'
  import { Form, HeadlessButton } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  interface Props {
    dictionary: Tables<'dictionaries'>
    isManager?: boolean
    partners: PartnerWithPhoto[]
    citation: string
    update_citation: (citation: string) => Promise<void>
  }

  const {
    dictionary,
    isManager = false,
    partners,
    citation,
    update_citation,
  }: Props = $props()

  let value = $state('')
  let unsaved = $state(false)
</script>

{#if isManager}
  <Form

    onsubmit={async () => {
      try {
        await update_citation(value.trim())
        unsaved = false
      } catch (err) {
        alert(err)
      }
    }}>
    {#snippet children({ loading })}
      <label for="names">
        {page.data.t('contributors.how_to_cite_instructions')}
      </label>
      <div style="margin-top: 0.25rem; display: flex; gap: 0.5rem">
        <input
          dir="ltr"
          id="names"
          placeholder="Anderson, Gregory D. S."
          type="text"
          class="citation-input"
          value={citation || ''}
          oninput={(e) => {
            // @ts-expect-error
            value = e.target.value.trim()
            unsaved = value !== citation
          }} />
        <HeadlessButton class="btn-primary btn-default citation-save-button" {loading} type="submit">
          {page.data.t('misc.save')}
        </HeadlessButton>
      </div>
    {/snippet}
  </Form>
{/if}

<div dir="ltr" class:unsaved>
  {build_citation({ t: page.data.t, dictionary, custom_citation: value || citation, partners })}
</div>

<style>
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-top: 1rem;
  }

  .citation-input {
    width: 100%;
  }

  :global(.citation-save-button) {
    flex-shrink: 0;
  }

  .unsaved {
    color: var(--warning);
  }
</style>
