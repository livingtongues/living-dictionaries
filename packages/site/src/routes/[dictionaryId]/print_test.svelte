<script lang="ts">
  import {onMount} from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';
  import { semanticDomains, partsOfSpeech, PrintLayout } from '@living-dictionaries/parts';
  import type { IEntry, ISpeaker } from '@living-dictionaries/types';
  import { getCollection } from 'sveltefirets';
  import { fetchSpeakers } from '$lib/helpers/fetchSpeakers';

  let speakers:ISpeaker[];
  let entries:IEntry[];
  onMount(async () => {
    entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    speakers = await fetchSpeakers(entries);
  });
  const selectedFields = {
    lo: true,
    lo2: true,
    lo3: true,
    lo4: true,
    lo5: true,
    ph: true,
    gl: true,
    ps: true,
    xv: true,
    xs: true,
    pf: true,
    sr: false,
    sd: false,
    id: false,
    in: false,
    mr: false,
    nc: false,
    pl: false,
    va: false,
    di: false,
    nt: false,
    sf: false,
    vfs: false,
    qr: false,
  }
</script>

{#if speakers}
  <PrintLayout {entries} {selectedFields} {speakers} dictionaryId={$dictionary.id} />
{/if}