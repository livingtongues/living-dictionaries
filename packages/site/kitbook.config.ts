import { defineConfig } from 'kitbook/defineConfig'
import { Locales } from './src/lib/i18n/locales'

export default defineConfig({
  title: 'Living Dictionaries',
  description: 'Svelte Component Documentation and Prototyping Workbench built for Living Dictionaries using Kitbook',
  githubURL: 'https://github.com/livingtongues/living-dictionaries/tree/main/packages/site',
  // expandTree: true,
  viewports: [
    { name: 'mobile', width: 375, height: 400 },
    { name: 'desktop', width: 786, height: 400 },
  ],
  languages: Object.entries(Locales).map(([code, name]) => ({ code, name })),
  addLanguageToUrl: ({ code, url }) => {
    const [path, search] = url.split('?')
    const params = new URLSearchParams(search)
    params.set('lang', code)
    return `${path}?${params.toString()}`
  },
})
