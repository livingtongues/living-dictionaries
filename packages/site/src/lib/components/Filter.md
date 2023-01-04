<script lang="ts">
  import { Story } from 'kitbook';
  import Filter from "./Filter.svelte";
</script>

# Filter

<Story>
  <Filter items={['this', 'is', 'testing', 'with', 'words']} let:filteredItems={items}>
    {#each items as item}
      <p>{item}</p>
    {/each}
  </Filter>
</Story>

<Story name="Dynamic placeholder" knobs={{dynamicPlaceholder: 'Search People'}} let:props={{dynamicPlaceholder}}>
  <Filter items={['Thomas Jefferson', 'George Washington']} placeholder={dynamicPlaceholder} let:filteredItems={items}>
    {#each items as item}
      <p>{item}</p>
    {/each}
  </Filter>
</Story>

<Story name="Empty array">
  <Filter items={[]} let:filteredItems={items}>
    {#each items as item}
      <p>{item}</p>
    {/each}
  </Filter>
</Story>