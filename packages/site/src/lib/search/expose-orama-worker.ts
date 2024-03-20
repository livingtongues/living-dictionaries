import { type Remote, wrap } from 'comlink'

const worker = new Worker(new URL('./orama.worker.ts', import.meta.url), { type: 'module' })
export const api: Remote<typeof import('./orama.worker').api> = wrap(worker)
