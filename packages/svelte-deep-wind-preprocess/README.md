# Svelte Deep Wind Preprocessor

Converts a Svelte file containing a child component with class names like this:

```svelte
<script>
  import Button from './Button.svelte';
</script>
<Button class="text-yellow-500 text-lg">
  Yellow
</Button>
```

Into this:

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

This will allow you to pass Windi CSS or Tailwind CSS classes to children Svelte components. When run before `svelte-windicss-preprocess` this will allow you to continue using component scoped styles, but now in a deep manner to pass to child components. *It was not intended for this but it would also allow you to use Tailwind classes arbitrarily on children components without any of those styles contributing to your sitewide stylesheet size.*

## Why not just use `windi:global`?
If you use the [`windi:global` style tag attribute](https://windicss.org/integrations/svelte.html#windi-css-classes)  you can pass classes into children components just fine, but be aware that your ability to use media query styles for that css utility is now ruined. For example if your sidebar uses `hidden md:block` to hide a button on mobile but show on larger screens and then you pass `hidden sm:inline` to a Button componenet in your header, you will have a problem if the styles from the header get added to the DOM after those from the sidebar. The reason is that media query styles don't have greater specificity. The class that gets defined last, wins. In this case the global `hidden` class from the header will override the expected behavior of `md:block` in your sidebar and your content will be hidden on all screen sizes. *This will at first seem odd to you as it can never be a problem in a situation where all utility styles are defined in one master css file as Tailwind/Windicss automatically put media query styles after normal styles, ranking from smallest screen to largest. This problem only shows up if you have global styles defined in multiple stylesheets.*

## How to use with `svelte-windicss-preprocess`
- install `npm i -D svelte-deep-wind-preprocess`
- `import deepWind from "svelte-deep-wind-preprocess";` and add `deepWind()` to your preprocessor array in `svelte.config.js` before `svelte-windicss-preprocess` runs.
- in Typescript situations due to markup being handed to this preprocessor before types are removed, we can't build an AST from the content without first stripping out the script block(s)

## Limitations
- Only modifies a file when script block comes first. This could easily be overcome by better logic that cuts script block out of any location properly. **The preprocessor is well tested with Vitest and PRs are welcome.** :)