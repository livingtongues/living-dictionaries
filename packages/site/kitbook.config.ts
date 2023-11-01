import { defineConfig } from 'kitbook/defineConfig'
// import { ReadyLocales } from './src/locales/languages.interface'

enum ReadyLocales {
  en = 'English',
  es = 'Español',
  fr = 'Français',
  zh = '中文',
  // sw = 'Kiswahili',
  // ru = 'русский',
  he = 'עברית',
  // pt = 'Portuguese',
  // id = 'Bahasa Indonesia',
  // ms = 'Malay',
  // bn = 'বাংলা', // Bengali,
  // as = 'Assamese / অসমীয়া',
  // hi = 'हिन्दी',
  // vi = 'Vietnamese',
}


export default defineConfig({
  title: 'Living Dictionaries',
  description: 'Svelte Component Documentation and Prototyping Workbench built for Living Dictionaries using Kitbook',
  githubURL: 'https://github.com/livingtongues/living-dictionaries/tree/main/packages/site',
  expandTree: true,
  viewports: [
    { name: 'mobile', width: 375, height: 400 },
    { name: 'desktop', width: 768, height: 400 },
  ],
  languages: Object.entries(ReadyLocales).map(([code, name]) => ({ code, name })),
  addLanguageToUrl: ({code, url}) => {
    const [path, search] = url.split('?')
    const params = new URLSearchParams(search)
    params.set('lang', code)
    return `${path}?${params.toString()}`
  }
})
