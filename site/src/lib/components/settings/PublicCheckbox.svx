<script lang="ts">
  import { Story } from 'kitbook';
  import PublicCheckbox from './PublicCheckbox.svelte';
</script>

# Public checkbox

<Story knobs={{ checked: true }} let:props={{ checked }} let:set>
  <PublicCheckbox {checked} on:changed={({ detail: { checked } }) => set('checked', checked)} />
</Story>

<Story name="Change can be reversed" knobs={{ checked: true }} let:props={{ checked }} let:set>
  <PublicCheckbox
    {checked}
    on:changed={({ detail: { checked } }) => {
      set('checked', checked);
      setTimeout(() => {
        if (checked && !confirm('make change?')) {
          set('checked', false);
        }
      }, 5);
    }} />
</Story>
