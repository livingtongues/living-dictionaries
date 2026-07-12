import { define_config } from 'svelte-look'

export default define_config({
  // Global stylesheets (order matches src/routes/+layout.svelte). The root layout doesn't
  // render in stories, so every global sheet must be listed here. reset-tailwind is listed
  // directly (unlayered — same effective result as the app's layer(reset) since stories
  // have no competing unlayered import order issues).
  css_files: [
    'src/routes/reset-tailwind.css',
    'src/lib/typography.css',
    'src/lib/theme.css',
    'src/lib/buttons.css',
    'src/lib/forms.css',
    'src/routes/global.css',
  ],

  // Default viewport for +page.svelte / +layout.svelte stories; components set their own.
  page_viewports: [
    { width: 480, height: 720 },
  ],

  dark_mode: true,
})
