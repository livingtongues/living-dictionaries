import { getVariants, runComponentTests } from 'kitbook/test'
import { expect, test } from '@playwright/test'
import kitbookConfig from '../kitbook.config'

const variantModules = await getVariants({
  skipFiles: [
    '/routes/[dictionaryId]/entries/table/EntriesTable',
    '/lib/components/maps/mapbox/static/MapboxStatic', // Skip Mapbox
    '/routes/[dictionaryId]/entry/[entryId]/GeoTaggingModal', // Skip Mapbox
  ]
})

runComponentTests({ test, expect, kitbookConfig, variantModules })
