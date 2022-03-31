<script lang="ts">
  // https://stackoverflow.com/questions/57464113/how-to-do-page-transitions-with-svelte-sapper
  // https://github.com/ryanditjia/sapper-boilerplate/blob/master/src/components/PageTransition.svelte
  export let padding = false,
    maxWidth = false;
</script>

<div
  class="{maxWidth && 'max-w-screen-md mx-auto'}
  {padding && 'p-3'}">
  <slot />
</div>

<!-- for pages like routes/post/[slug].svelte you will need a workaround
{#each [post] as p (p.slug)}
  <View>
    <div>{@html post.html}</div>
  </View>
{/each}
What this does is give key to component (in this case slug). If slug changes (moving from a blog post to the next), transition happens -->
