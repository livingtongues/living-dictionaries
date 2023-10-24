import { clearSnapshots, getVariants, runComponentTests } from 'kitbook/test'
import { expect, test } from '@playwright/test'
import kitbookConfig from '../kitbook.config'
import { init } from 'svelte-i18n';
init({ fallbackLocale: 'en', initialLocale: 'en', warnOnMissingMessages: false });

clearSnapshots()
const variantModules = await getVariants({skipFiles: [
  '/routes/[dictionaryId]/entries/table/EntriesTable',
  '/routes/[dictionaryId]/entry/[entryId]/GeoTaggingModal' // Skip Mapbox
]})

runComponentTests({ test, expect, kitbookConfig, variantModules })
