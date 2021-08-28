/**
 * Delete completely duplicated entries and log stats for partial duplicates as well as number of duplicate image and audio references.
 */
export const deleteDuplicateEntries = (data: any[]) => {
    const uniqueLexemes: string[] = [];
    const uniqueAudioReferences: string[] = [];
    const uniqueImageReferences: string[] = [];
    let duplicateAudioReferences = 0;
    let duplicateImageReferences = 0;
    let duplicateEntries = 0;

    for (const entry of data) {
        if (entry.audio) {
            if (uniqueAudioReferences.indexOf(entry.audio) === -1) {
                uniqueAudioReferences.push(entry.audio);
            } else {
                duplicateAudioReferences++;
            }
        }
        if (entry.image) {
            if (uniqueImageReferences.indexOf(entry.image) === -1) {
                uniqueImageReferences.push(entry.image);
            } else {
                duplicateImageReferences++;
            }
        }
    }

    for (var i = data.length - 1; i >= 0; i--) {
        const entry = data[i];
        const nextEntry = data[i + 1];
        if (entry.lang) {
            if (uniqueLexemes.indexOf(entry.lang) === -1) {
                uniqueLexemes.push(entry.lang);
            } else {
                let uniqueEntry = false;
                Object.keys(entry).forEach(key => {
                    if ((key != 'oid') && (entry[key] != nextEntry[key])) {
                        // console.log(entry[key], ' >> ', nextEntry[key]);
                        uniqueEntry = true;
                    }
                })
                if (!uniqueEntry) {
                    duplicateEntries++;
                    console.log('\nRemoved', entry, '\nas it is a complete duplicate with: ', nextEntry);
                    data.splice(i, 1);
                }
            }
        } else {
            console.log('\nNo lang field found for: ', entry.oid);
        }
    }

    console.log(`\nLexeme duplicates: ${data.length - uniqueLexemes.length} duplicates out of ${data.length} entries`);
    console.log(` Removed ${duplicateEntries} completely duplicate entries. The other ${data.length - uniqueLexemes.length - duplicateEntries} lexeme duplicates had at least 1 difference in the entry data and should be manually consolidated later on the site.`); // math will be wrong for dictionaries who have entries with no lexeme (lang field)
    
    console.log(` Unique audio references: ${uniqueAudioReferences.length} < would be great if this matched the audioFileCount above`);
    if (duplicateAudioReferences) {
        console.log(` Duplicate audio references: ${duplicateAudioReferences} < each entry that has a duplicate audio reference (meaning another entry also points to the same audio file in the old Talking Dictionaries) will upload its own unique renamed audio file so that none of the entries have intertwined media that other entries depend on. This will allow us to clean up duplicate entries and their associated media with ease without worrying about deleting media that other entries depend on.`);
    }

    console.log(` Unique image references: ${uniqueImageReferences.length} < would be great if this matched the imageFileCount above`);
    if (duplicateImageReferences) {
        console.log(` Duplicate image references: ${duplicateImageReferences} < same story here as with duplicate audio references`);
    }
    return data;
}



// Scratch notes

// export const deleteDuplicateEntries = (data: any[]) => {
//     const start = Date.now();
//     const uniqueLexemes: string[] = [];
//     const uniqueAudioReferences: string[] = [];
//     const uniqueImageReferences: string[] = [];


//     let entries = new Set();
//     for (const entry of data) {
//         delete entry.oid;
//         entries.add(entry);
//     }
//     console.log(data.length, entries.size);

//     return data;
//     const uniqueKeys: string[] = [];
//     for (const entry of data) {
//         Object.keys(entry).forEach(key => {
//             if (uniqueKeys.indexOf(key) === -1) uniqueKeys.push(key);
//         })
//     }
//     const oidIndex = uniqueKeys.indexOf('oid');
//     uniqueKeys.splice(oidIndex, 1);
//     console.log(uniqueKeys);

//     console.log('\nListing Entries with Duplicates audio files:')

//     for (var i = data.length - 1; i >= 0; i--) {
//         if (data[i].lang) {
//             if (uniqueAudioReferences.indexOf(data[i].audio) === -1) {
//                 uniqueAudioReferences.push(data[i].audio);
//             }
//         }
//     }

//     for (var i = data.length - 1; i >= 0; i--) {
//         if (data[i].image) {
//             if (uniqueImageReferences.indexOf(data[i].image) === -1) {
//                 uniqueImageReferences.push(data[i].image);
//             } else {
//                 console.log('Duplicate image reference, ', data[i].lang, data[i].image);
//             }
//         }
//     }

//     for (var i = data.length - 1; i >= 0; i--) {
//         const entry = data[i];
//         const nextEntry = data[i + 1];
//         if (data[i].lang) {
//             if (uniqueLexemes.indexOf(data[i].lang) === -1) {
//                 uniqueLexemes.push(data[i].lang);
//             } else {
//                 console.log(entry.oid);
//                 Object.keys(entry).forEach(key => {
//                     Boolean(entry[key]) && Boolean(nextEntry[key]) && Boolean(entry[key] != nextEntry[key]) && console.log(entry[key], ' >> ', nextEntry[key]);
//                 })
//                 console.log('');
//                 console.log('\n>>> Duplicate: ', data[i].lang);
//                 if (data[i].audio == data[i + 1].audio) {
//                     console.log('Removing (same audio file)');
//                     console.log(data[i].gloss)
//                     console.log(data[i + 1].gloss)
//                     data.splice(i, 1);
//                 } else {
//                     console.log('Skipping (different audio files');
//                     console.log(data[i].audio);
//                     console.log(data[i + 1].audio);
//                     console.log(data[i].gloss)
//                     console.log(data[i + 1].gloss)
//                 }
//             }
//         }
//     }
//     console.log(uniqueLexemes.length, uniqueAudioReferences.length);

//     console.log(`Found ${data.length - uniqueLexemes.length} duplicates out of ${data.length} entries in ${Date.now() - start}ms.\n`)
//     return data;
// }