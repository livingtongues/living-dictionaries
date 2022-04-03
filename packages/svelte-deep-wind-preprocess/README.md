# Svelte Deep Wind Preprocessor

Converts a component like:

```svelte
<script>
  import Button from './Button.svelte';
</script>
<Button class="text-yellow-500 text-lg">
  Yellow
</Button>
```

Into:

```svelte
<script>
  import Button from './Button.svelte';
</script>
<Button class="deep_text-yellow-500_text-lg">
      Yellow
</Button>
<style> 
  :global(.deep_text-yellow-500) { @apply text-yellow-500 text-lg; }
</style>
```

This will allow you to pass Windicss classes to children Svelte components.

## Why not just use `windi:global`?
If you use the [`windi:global` style tag attribute](https://windicss.org/integrations/svelte.html#windi-css-classes)  you can pass classes into children components just fine, but be aware that your ability to use media query styles for that css utility is now be ruined. For example if your sidebar uses `hidden md:block` to hide a button on mobile but show on larger screens and then you pass `hidden sm:inline` to a Button componenet in your header, you will have a problem if the styles from the header gets added to the DOM after those from the sidebar. The reason is that media query styles don't have greater specificity. The class that gets defined last, wins. In this case the global `hidden` class from the header will override the expected behavior of `md:block` in your sidebar and your content will be hidden on all screen sizes. *This will at first seem odd to you as it can never be a problem in a situation where all utility styles are defined in one master css file. Tailwind/Windicss automatically put media query styles after normal styles, ranking from smallest screen to largest.*

## Get Started
- install `npm i -D svelte-deep-wind-preprocess`
- `import deepWind from "svelte-deep-wind-preprocess";` and add `deepWind()` to your preprocessor array in `svelte.config.js` before `svelte-windicss-preprocess` runs.
- in Typescript situations due to markup being handed to this preprocessor before types are removed, we can't build an AST from the content without first stripping out the script block(s)

## Limitations
- Only runs when script block comes first. This could be overcome by better logic that cuts script block out of it's location properly. PRs are welcome. :)