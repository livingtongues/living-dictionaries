import fs from 'fs';
import { preprocess } from 'svelte/compiler';
import svelteDeepWind from './index.js';

test('Preprocessor allows rtl classes to be passed down to child component', async () => {
  const result = await preprocess(
    `<Menu {portal} class="right-2 rtl:left-2 ltr:right-[4px] top-11">
      <div class="ltr:mt-2">Hello</div>
    </Menu>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<Menu {portal} class=\\"deep_right-2_rtl-left-2_ltr-right-[4px]_top-11\\">
          <div class=\\"ltr_mt-2\\">Hello</div>
        </Menu><style> :global(.deep_right-2_rtl-left-2_ltr-right-\\\\[4px\\\\]_top-11) { @apply right-2 top-11; } :global([dir=rtl] .deep_right-2_rtl-left-2_ltr-right-\\\\[4px\\\\]_top-11) { @apply left-2; } :global([dir=ltr] .deep_right-2_rtl-left-2_ltr-right-\\\\[4px\\\\]_top-11) { @apply right-[4px]; } :global([dir=rtl] .rtl_left-2) { @apply left-2; } :global([dir=ltr] .ltr_right-\\\\[4px\\\\]) { @apply right-[4px]; } :global([dir=ltr] .ltr_mt-2) { @apply mt-2; }</style>"
  `);
})

test('Preprocessor makes rtl and ltr classes global to keep Svelte compiler from stripping out', async () => {
  const result = await preprocess(
    `<div class="ltr:ml-2">LTR</div>
    <div class="ltr:mt-2">LTR</div>
    <div class="rtl:mr-2 ltr:sm:mt-[4px]">RTL</div>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<div class=\\"ltr_ml-2\\">LTR</div>
        <div class=\\"ltr_mt-2\\">LTR</div>
        <div class=\\"rtl_mr-2 ltr_sm:mt-[4px]\\">RTL</div><style> :global([dir=rtl] .rtl_mr-2) { @apply mr-2; } :global([dir=ltr] .ltr_ml-2) { @apply ml-2; } :global([dir=ltr] .ltr_mt-2) { @apply mt-2; } :global([dir=ltr] .ltr_sm\\\\:mt-\\\\[4px\\\\]) { @apply sm:mt-[4px]; }</style>"
  `);
})

test('Preprocessor handles line breaks @apply style lines', async () => {
  const result = await preprocess(
    `<style>
    :global(.sv-menu button) {
      @apply text-left px-4 py-2 text-sm text-gray-700 
      hover:bg-gray-100 transition ease-in-out duration-150;
    }
    .sv-menu {
      @apply py-1 rounded-md bg-white flex flex-col;
    }
  </style>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<style>
        :global(.sv-menu button) {
          @apply text-left px-4 py-2 text-sm text-gray-700 
          hover:bg-gray-100 transition ease-in-out duration-150;
        }
        .sv-menu {
          @apply py-1 rounded-md bg-white flex flex-col;
        }
      </style>"
  `);
});


test('Preprocessor handles ! in Component class names by escaping it in deep name', async () => {
  const result = await preprocess(
    `<script>
    import Button from './Button.svelte';
  </script>
  <Button class="!text-yellow-500 text-lg">
  Yellow
</Button>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<script>
        import Button from './Button.svelte';
      </script>
      <Button class=\\"deep_!text-yellow-500_text-lg\\">
      Yellow
    </Button><style> :global(.deep_\\\\!text-yellow-500_text-lg) { @apply !text-yellow-500 text-lg; }</style>"
  `);
});

test('Preprocessor handles @apply and colons in style tag', async () => {
  const result = await preprocess(
    `<script>
    import Button from './Button.svelte';
  </script>
  <Button class="text-yellow-500">
  Yellow
</Button>
<style>
.foo {
  @apply focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded;
}
.bar {
  @apply focus:ring-primary-600;
}
</style>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<script>
        import Button from './Button.svelte';
      </script>
      <Button class=\\"deep_text-yellow-500\\">
      Yellow
    </Button>
    <style> :global(.deep_text-yellow-500) { @apply text-yellow-500; }
    .foo {
      @apply focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded;
    }
    .bar {
      @apply focus:ring-primary-600;
    }
    </style>"
  `);
});

test('Preprocessor handles existing style tag', async () => {
  const inputFile = fs.readFileSync('./input/ButtonParent.svelte', 'utf-8');
  const result = await preprocess(inputFile, [svelteDeepWind()]);
  expect(result.code).toMatchInlineSnapshot(`
    "<script>
      import Button from './Button.svelte';
      const fruits = ['apple', 'banana', 'orange', 'grape']
    </script>
    
    <Button class=\\"deep_hidden_sm-block_text-blue-200\\">
      <ul>
        {#each fruits as fruit}
          <li>{fruit}</li>
        {/each}
      </ul>
    </Button>
    
    <Button class=\\"deep_text-yellow-500\\">
      Yellow One
    </Button>
    
    <Button>
      <div class=\\"decoy\\">
        Decoy
      </div>
    </Button>
    
    <style> :global(.deep_hidden_sm-block_text-blue-200) { @apply hidden sm:block text-blue-200; } :global(.deep_text-yellow-500) { @apply text-yellow-500; }
      .decoy {
        color: red;
      }
    </style>"
  `);
});

test('Preprocessor handles no style tag', async () => {
  const result = await preprocess(
    `<script>
    import Button from './Button.svelte';
  </script>
  <Button class="text-yellow-500">
  Yellow
</Button>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<script>
        import Button from './Button.svelte';
      </script>
      <Button class=\\"deep_text-yellow-500\\">
      Yellow
    </Button><style> :global(.deep_text-yellow-500) { @apply text-yellow-500; }</style>"
  `);
});

test('Preprocessor handles no component classes', async () => {
  const result = await preprocess(
    `<div class="decoy">
  Decoy
</div>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<div class=\\"decoy\\">
      Decoy
    </div>"
  `);
});

test('Preprocessor skips a file if has Typescript and is not starting with script block', async () => {
  const result = await preprocess(
    `<!-- Comment --> 
    <script lang="ts">
    import Button from './Button.svelte';
  </script>
  <Button class="text-yellow-500">
  Yellow
</Button>`,
    [svelteDeepWind()]
  );
  expect(result.code).toMatchInlineSnapshot(`
    "<!-- Comment --> 
        <script lang=\\"ts\\">
        import Button from './Button.svelte';
      </script>
      <Button class=\\"text-yellow-500\\">
      Yellow
    </Button>"
  `);
});

test('Preprocessor handles file with Typescript', async () => {
  const inputFile = fs.readFileSync('./input/HasTypescript.svelte', 'utf-8');
  const result = await preprocess(inputFile, [svelteDeepWind()]);
  fs.writeFileSync('./output/HasTypescript.svelte', result.code, 'utf-8');
});

test('Preprocessor handles file with Typescript and @apply classes in style block', async () => {
  const inputFile = fs.readFileSync('./input/__layout.svelte', 'utf-8');
  const result = await preprocess(inputFile, [svelteDeepWind()]);
  expect(result.code).toEqual(inputFile);
});