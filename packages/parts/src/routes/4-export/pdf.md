<script lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  const entries: IEntry[] = [
    //...add a couple sample entry objects for mocking
  ];
</script>

<!-- prettier-ignore -->
# Birhor

*Desired metadata...*

{#each entries as entry}
  ## {entry.lx}

  ...

{/each}
