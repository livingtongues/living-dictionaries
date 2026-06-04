import { define_config } from 'svelte-look'

export default define_config({
  // App styles globally with UnoCSS — utilities live in `virtual:uno.css` (imported once in the
  // root layout, not per-component), so pull it + the reset in for CSR screenshots. Order matches
  // src/routes/+layout.svelte.
  css_imports: ['@unocss/reset/tailwind.css', 'virtual:uno.css'],
  css_files: ['src/routes/global.css'],

  // Default viewport for +page.svelte / +layout.svelte stories; components set their own.
  page_viewports: [
    { width: 480, height: 720 },
  ],

  // Living Dictionaries is a light-only app.
  dark_mode: false,
})
