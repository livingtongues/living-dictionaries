import { readFile, writeFile } from 'node:fs'

const inputFilePath = './packages/scripts/migrate-to-supabase/entries_full.json'
const outputFilePath = './packages/scripts/migrate-to-supabase/entries.json'

const start_index = 0
const batch_size = 200

// node ./packages/scripts/migrate-to-supabase/batch.js

readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err)
    return
  }

  try {
    // Parse the JSON data
    const jsonArray = JSON.parse(data)

    // Extract the desired range of elements
    const selectedData = jsonArray.slice(start_index, start_index + batch_size)
    console.log({ num: selectedData.length })

    // Write the selected data to a new file
    writeFile(outputFilePath, JSON.stringify(selectedData, null, 2).replaceAll('_seconds', 'seconds'), (err) => {
      if (err) {
        console.error('Error writing the file:', err)
      } else {
        console.log('File has been written with selected data.')
      }
    })
  } catch (parseError) {
    console.error('Error parsing JSON data:', parseError)
  }
})
