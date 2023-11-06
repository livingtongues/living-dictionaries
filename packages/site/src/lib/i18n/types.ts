import type { en } from '.'

export type TranslationKeys = Flatten<TranslationKeysNested>

type TranslationKeysNested = {
  [K in keyof typeof en]: {
    [L in StringKeyof<typeof en[K]>]: `${K}.${L}`
  }
}[keyof typeof en]

type StringKeyof<T> = Extract<keyof T, string>
type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } extends Record<keyof U, infer V> ? V : never : never
