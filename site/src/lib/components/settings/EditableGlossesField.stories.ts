import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EditableGlossesField.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 620 }],
  page_data: {
    t: (key: string | { dynamicKey?: string, fallback?: string }) => {
      if (typeof key === 'object')
        return key.fallback || key.dynamicKey || ''
      const labels: Record<string, string> = {
        'create.gloss_dictionary_in': 'Make dictionary available in',
        'misc.add': 'Add',
        'about.search': 'Search',
      }
      return labels[key] || key
    },
  },
}

const available_languages = {
  en: { vernacularName: 'English' },
  es: { vernacularName: 'español' },
  fr: { vernacularName: 'français' },
  hi: { vernacularName: 'हिन्दी' },
}

export const Badges: Story<typeof Component> = {
  props: {
    availableLanguages: available_languages as any,
    selectedLanguages: ['en', 'es'],
    add_language: () => {},
    remove_language: () => {},
  },
}

export const ModalOpen: Story<typeof Component> = {
  csr: true,
  props: {
    availableLanguages: available_languages as any,
    selectedLanguages: ['en', 'es'],
    add_language: () => {},
    remove_language: () => {},
  },
  interactions: async (page) => {
    const buttons = await page.$$('button')
    for (const button of buttons) {
      const text = await button.evaluate((el: HTMLElement) => el.textContent)
      if (text.includes('Add')) {
        await button.click()
        break
      }
    }
    await page.waitForSelector('.modal-card')
    await new Promise(resolve => setTimeout(resolve, 350))
  },
}
