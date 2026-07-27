import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SpecialCharacterButtons.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 420, height: 90 }],
}

const on_select = () => {}

export const Ponca: Story<typeof Component> = {
  props: { characters: ['đ', 'ʼ', 'ą', 'ę', 'į', 'ų', 'ǫ', 'š', 'ž', 'č', 'ʃ', 'ə', '·'], on_select },
}

export const WithCombiningGraphemes: Story<typeof Component> = {
  props: { characters: ['ą́', 'ą̀', 'į́', 'ų́', 'ǫ́'], on_select },
}

export const Empty: Story<typeof Component> = {
  props: { characters: [], on_select },
}
