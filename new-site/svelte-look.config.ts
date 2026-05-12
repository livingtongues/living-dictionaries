import { define_config } from 'svelte-look'

export default define_config({
  css_files: ['src/lib/theme.css'],
  mocks: 'src/lib/mocks/svelte-look-mocks.ts',
  dark_mode: true,
  page_viewports: [
    { width: 480, height: 720 },
  ],
})
