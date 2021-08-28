/**
 * Fix abnormalities and odd characters in old Talking Dictionaries data by converting JSON to a string, find-replacing, and converting back to JSON.
 */
export const cleanUpData = (data: any[]) => {
    const cleanedData = JSON.parse(
        JSON.stringify(data)
            .replace(/&#8217;/g, '\'') // handle apostrophes
            .replace(/&quot;/g, '\'') // handle quote marks in ho, '\"' and \u0022 threw errors from closing value
            .replace(/\\u0000/g, '') // handle odd null values in first 4 entries of ho
            .replace(/ib_gloss/g, 'ig_gloss') // convert "ib" to "ig" for "Igbo" in Olukumi
    );
    return cleanedData;
}