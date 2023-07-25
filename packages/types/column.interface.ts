export interface IColumn {
    field: string,
    width: number,
    sticky?: boolean,
    hidden?: boolean,

    display?: string, // for gloss, exampleSentences and alternateOrthographies added later
    explanation?: string; // e.g. show vernacular language title on hover instead of current language title for that particular gloss language
    orthography?: boolean,

    // TODO: combine these into the parentField field if workable in Cell.svelte
    gloss?: boolean,
    exampleSentence?: boolean,
    // parentField?: string; // gl | xs | sf | pf
  }
