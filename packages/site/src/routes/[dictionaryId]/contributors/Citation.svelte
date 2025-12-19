<script lang="ts">
  import { Button, Form } from '$lib/svelte-pieces'
  import type { PartnerWithPhoto, Tables } from '@living-dictionaries/types'
  import { build_citation } from './build-citation'
  import { page } from '$app/stores'

  interface Props {
    dictionary: Tables<'dictionaries'>;
    isManager?: boolean;
    partners: PartnerWithPhoto[];
    citation: string;
    update_citation: (citation: string) => Promise<void>;
  }

  let {
    dictionary,
    isManager = false,
    partners,
    citation,
    update_citation
  }: Props = $props();

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
        <label for="names" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
        {$page.data.t('contributors.how_to_cite_instructions')}
      </label>
      <div class="mt-1 flex">
        <input
          dir="ltr"
          id="names"
          placeholder="Anderson, Gregory D. S."
          type="text"
          class="form-input w-full"
          value={citation || ''}
          oninput={(e) => {
            // @ts-expect-error
            value = e.target.value.trim()
            unsaved = value !== citation
          }} />
        <div class="w-1"></div>
        <Button class="shrink-0" {loading} type="submit">
          {$page.data.t('misc.save')}
        </Button>
      </div>
          {/snippet}
    </Form>
{/if}

<div dir="ltr" class:text-orange={unsaved}>
  {build_citation({ t: $page.data.t, dictionary, custom_citation: value || citation, partners })}
</div>
