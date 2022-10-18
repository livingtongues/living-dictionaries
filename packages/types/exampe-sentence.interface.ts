export interface IExampleSentence {
    // vn?: string; // vernacular
    [bcp: string | 'vn']: string; // example sentences in glossing languages
}

// Can write an example sentence in the vernacular and in any of the glossing languages