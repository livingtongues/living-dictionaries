<script lang="ts">
  import { Story } from "kitbook";
  import EditableAlternateNames from './EditableAlternateNames.svelte';
  import ReactiveSet from 'svelte-pieces/functions/ReactiveSet.svelte';
</script>

<!-- prettier-ignore -->
# Edit Alternate Names

Listen to the `update` event when adding or removing alternate names.

<Story>
  <ReactiveSet input={['Lengua materna']} let:value={alternateNames} let:update>
    <EditableAlternateNames {alternateNames} on:update={(e) => update(e.detail.alternateNames)} />
    <div>
      Array state:
      <pre>{alternateNames}</pre>
    </div>
  </ReactiveSet>
</Story>
