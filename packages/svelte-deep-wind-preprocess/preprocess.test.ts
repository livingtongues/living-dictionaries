import fs from 'fs';
import { preprocess } from 'svelte/compiler';
import svelteDeepWind from './index.js';

test('svelteDeepWind preprocesses file with existing style tag', async () => {
  const inputFile = fs.readFileSync('./input/Header.svelte', 'utf-8');
  const result = await preprocess(inputFile, [svelteDeepWind()]);
  fs.writeFileSync('./output/Header.svelte', result.code, 'utf-8');
});

test('svelteDeepWind preprocesses file with existing style tag', async () => {
  const inputFile = fs.readFileSync('./input/ButtonParent.svelte', 'utf-8');
  const result = await preprocess(inputFile, [svelteDeepWind()]);
  // fs.writeFileSync('./Output.svelte', result.code, 'utf-8');
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

test('Preprocessor handles file without a style tag', async () => {
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

test('Preprocessor handles file without component classes', async () => {
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
