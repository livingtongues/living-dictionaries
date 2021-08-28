import { abbreviateTDPartOfSpeech } from "./abbreviate-td-pos";

/**
 * Logs unique parts and throw an error if any unmatched parts found so we know what to fix. Fix as many as we want to, then comment Error throwing to allow unmatched POS to be simple write-ins.
 */
export const findUnmatchedPOS = (data: any[]) => {
    console.log('\n---------------------\nMatching Parts of Speech for ', data.length, ' entries');
    const uniquePOS: string[] = [];
    const repeatedPOS: string[] = [];
    const unmatchedPOS: string[] = [];

    for (const entry of data) {
        if (entry.pos) {
            const pos = entry.pos;
            if (uniquePOS.indexOf(pos) === -1) uniquePOS.push(pos);
            repeatedPOS.push(pos);
        }
    }

    console.log('\nUnmatched POS: ')
    uniquePOS.forEach((pos: string) => {
        const { matchedPOS } = abbreviateTDPartOfSpeech(pos);
        if (matchedPOS) {
            // console.log(`Matched Unique POS|${pos}|`);
        } else {
            // console.log(`>> Unmatched Unique POS\n|${pos}|`);
            console.log(`${pos}`);
            unmatchedPOS.push(pos);
        }
    })

    console.log('\nRepeat unmatched POS to get a feel for the quantity of unmatched POS');
    repeatedPOS.forEach((pos: string) => {
        const { matchedPOS } = abbreviateTDPartOfSpeech(pos);
        if (!matchedPOS) {
            // console.log(`>> Unmatched Unique POS\n|${pos}|`);
            console.log(`|${pos}|`);
        }
    })

    if (unmatchedPOS.length) {
        console.log('Not all POS found matches so they will be saved as is (simple strings of text w/o abbreviations or translations).')
        // throw new Error(`No abbreviation found for some POS. See log.`);
    }
    return unmatchedPOS;
}
