<script>
  import Button from './Button.svelte';
  const fruits = ['apple', 'banana', 'orange', 'grape']
</script>

<Button class="hidden sm:block text-blue-200">
  <ul>
    {#each fruits as fruit}
      <li>{fruit}</li>
    {/each}
  </ul>
</Button>

<Button class="text-yellow-500">
  Yellow One
</Button>

<Button>
  <div class="decoy">
    Decoy
  </div>
</Button>

<style>
  .decoy {
    color: red;
  }
</style>