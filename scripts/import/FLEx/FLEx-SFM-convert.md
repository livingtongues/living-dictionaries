## Convert to key-value pairs

Find: `\\(\S*) (.*)`
Replace: `$1: "$2",`

## Make each entry a separate object

`\n\n`
`},\n{`

## Turn the data into an array and surround with brackets not added in previous find-replace

export const data = [{}]

Converted single ph_Tor_IPA into ph
converted single lc (citation form) into note: Citation form ...
Made lexeme with two xv_Tor into one field with a | between them

Find ending whitespace (?!:)[\S] "
