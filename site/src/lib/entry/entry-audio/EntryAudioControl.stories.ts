import type { Story, StoryMeta } from 'svelte-look'
import type Component from './EntryAudioControl.svelte'
import type { AudioOptionInput } from './audio-option-labels'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 90, height: 54 }],
  page_data: { t: mock_t, locale: 'en' },
}

const audio = ({ id, name }: { id: string, name?: string | null }): AudioOptionInput =>
  ({ id, storage_path: `story-dict/audio/${id}.mp3`, speaker_name: name ?? null })

const two_speakers = [audio({ id: 'a1', name: 'Rosa Lopez' }), audio({ id: 'a2', name: 'Sam Brown' })]

/** The 'aahmaa-shaped dense case: six recordings, repeated names, a long name, a speakerless recording. */
const six_recordings = [
  audio({ id: 'a1', name: 'Marta Rodriguez' }),
  audio({ id: 'a2', name: 'Marta Rodriguez' }),
  audio({ id: 'a3', name: 'Sam Brown' }),
  audio({ id: 'a4', name: 'Sam Brown' }),
  audio({ id: 'a5', name: 'Josefina Altagracia Amaya de la Cruz' }),
  audio({ id: 'a6' }),
]

/** Keep the tapped recording visibly active: play() pending forever, so failure never clears the state. */
async function open_chooser(page: any) {
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => new Promise<void>(() => {})
  })
  await page.click('button.trigger')
  await page.waitForSelector('.row')
}

/** Single recording — unchanged compact circle, no badge. */
export const Single: Story<typeof Component> = {
  props: { audios: [audio({ id: 'a1', name: 'Rosa Lopez' })], entry_id: 'e1', surface: 'list', entry_name: 'pilly weraaw' },
}

/** Two recordings — count badge on the same footprint. */
export const TwoCollapsed: Story<typeof Component> = {
  props: { audios: two_speakers, entry_id: 'e1', surface: 'list', entry_name: 'pilly weraaw' },
}

/** Tap → popover opens AND recording 1 plays (filled trigger + active first row). */
export const TwoExpanded: Story<typeof Component> = {
  viewports: [{ width: 700, height: 300 }],
  csr: true,
  interactions: open_chooser,
  props: { audios: two_speakers, entry_id: 'e1', surface: 'list', entry_name: 'pilly weraaw' },
}

/** Dense case: duplicate names get quiet ordinals, the long name truncates, the speakerless recording shows its bare position. */
export const SixExpanded: Story<typeof Component> = {
  viewports: [{ width: 700, height: 420 }],
  csr: true,
  interactions: open_chooser,
  props: { audios: six_recordings, entry_id: 'e1', surface: 'list', entry_name: "'aahmaa" },
}

/** Same dense chooser at phone width — Popover renders its bottom sheet. */
export const SixExpandedPhone: Story<typeof Component> = {
  viewports: [{ width: 390, height: 560 }],
  csr: true,
  interactions: open_chooser,
  props: { audios: six_recordings, entry_id: 'e1', surface: 'list', entry_name: "'aahmaa" },
}

/** Switching to a non-first recording: row 3 active, others immediately tappable. */
export const ActiveNonFirst: Story<typeof Component> = {
  viewports: [{ width: 700, height: 420 }],
  csr: true,
  interactions: async (page) => {
    await open_chooser(page)
    const rows = await page.$$('.row')
    await rows[2].click()
    // Let the background/color transition settle before the screenshot.
    await new Promise(resolve => setTimeout(resolve, 450))
  },
  props: { audios: six_recordings, entry_id: 'e1', surface: 'list', entry_name: "'aahmaa" },
}

/** Single-recording tap → transient speaker-name bubble beside the control (~2s). */
export const TransientName: Story<typeof Component> = {
  viewports: [{ width: 340, height: 120 }],
  csr: true,
  interactions: async (page) => {
    await page.evaluate(() => {
      HTMLMediaElement.prototype.play = () => new Promise<void>(() => {})
    })
    await page.click('button.trigger')
    await page.waitForSelector('.transient-name')
  },
  props: { audios: [audio({ id: 'a1', name: 'Rosa Lopez' })], entry_id: 'e1', surface: 'list', entry_name: 'pilly weraaw' },
}
