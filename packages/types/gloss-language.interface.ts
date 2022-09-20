// BCP47 https://www.google.com/url?q=https://www.w3.org/International/articles/language-tags/&sa=D&ust=1610645045591000&usg=AFQjCNEcqauESoZHcQuEffpfDl6gC7KWIw, also LanguageCode in Keyman
export interface IGlossLanguages {
  [bcp: string]: IGlossLanguage;
}

export interface IGlossLanguage {
  vernacularName?: string;
  vernacularAlternate?: string;
  internalName?: string; // InternalName in Keyman
  useKeyboard?: string; // allow to use keyboard listed under a different or more specific bcp47 code
  showKeyboard?: boolean; // for Keyman
}
