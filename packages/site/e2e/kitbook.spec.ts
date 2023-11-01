import { getVariants, runComponentTests } from 'kitbook/test'
import { expect, test } from '@playwright/test'
import kitbookConfig from '../kitbook.config'
import { init } from 'svelte-i18n';

init({ fallbackLocale: 'en', initialLocale: 'en', warnOnMissingMessages: false }); // some of our mocks are expanded while being created which includes i18n

const variantModules = await getVariants({skipFiles: [
  '/lib/components/maps/mapbox/static/MapboxStatic',
  '/routes/[dictionaryId]/entries/table/EntriesTable',
  '/routes/[dictionaryId]/entry/[entryId]/GeoTaggingModal' // Skip Mapbox
]})

runComponentTests({ test, expect, kitbookConfig, variantModules })
