interface Entry {
  id: string
  lexemeForm: MultiString // thanks for this inspiration - we started with just a lexeme string field, and then people asked for more orthographies and we made them second class citizens as optional alternate orthographies. This accomplishes the same purpose as the multi-string here but it's not as elegant and has pain points. For example, once someone decided they wanted to make an alternate orthography the main orthography, but they couldn't. So I don't like it our current model and will use a MultiString after our migration.
  citationForm: MultiString // Am I correct that citation form is a convention from a world where print is the only medium? We don't have this field. In my opinion, if you have a lexeme that is important enough to add and gloss, like "radii" and the citation form is "radius", then in a digital dictionary, these belong as two separate entries with a relationship from radii to radius. Not sure what the relationship would be called but something like "child-citation" indicating that the "radii" entry is really an offshoot of the base word "radius". But at the end of the day we do have a very simple print view, so print conventions are still in view but in our world they are second-class citizens. Web usage with easy bouncing between entries via links is first-class. However, we don't have a system for relationships yet. That will be a further down the road benefit of our migration. In that it will be easy to indicate relationships between entries. For now we do have a few additional fields users can use to add some basic info like a "plural_form" field, and a deprecated "variant" field. I don't really like these but we have them at the moment.
  literalMeaning: MultiString // What is this field for? We have nothing like it. Meaning is based on sense and you already have gloss and definition fields there.
  senses: Sense[]
  note: MultiString // our notes field is just a string - we are going to move to using MultiString to allow for different analysis writing systems. Needed when importing flex data.
  // Additional fields we have
  // phonetic?: string;
  // morphology?: string;
  // interlinearization?: string;
  // dialects?: string[]; -- this will be upgraded to its own table down the road
  // sources?: string[];
  // scientific_names?: string[]; // italic by default but they can use <i> and </i> to define where italics show
  // coordinates?: Coordinates; // points and/or regions
}

interface Sense {
  id: string
  gloss: MultiString
  definition: MultiString // we have this field used in our first dictionary but we don't show the field when it is empty (ie - we don't encourage it's use and just use glosses but that could change)
  partOfSpeech: string // this is an array because some entries serve as multiple parts of speech, we have a specific set which are keys that are translated in the UI (eg. "n" -> "noun" in English / "sustantivo" in Spanish)
  semanticDomain: string[] // we have a specific set which are keys that are translated in the UI (it's a majorly simplified system modeled after SemDom with some adjustments) a universal set of domains is nice for cross-linguistic work but doesn't always fit the semantic categories of a language so future growth in our semantic domains field could go a lot of different directions depending on needs, like accepting different systems (ie -SEMDOM) or letting a dictionary itself set up custom domains. We also plan to introduce tags, which would be multi-purpose for many different applications and that may negate the need for a dictionary to create their own domains.
  // write_in_semantic_domains?: string[] // used to support legacy dictionaries, and obviously not translated. We show these and let users delete these and swap them out for the new system, but we don't allow editing or adding.
  exampleSentences: ExampleSentence[]
  // noun_class?: string; additional field we have
}

interface ExampleSentence { // upgrading these to be first class citizens called Sentence
  id: string
  sentence: MultiString
  translation: MultiString
  reference: string // further fields like this haven't been thought through yet but there's room to grow
}

interface MultiString {
  values: Record<WritingSystemId, string> // Our current use of something that's like MultiString doesn't nest values underneath a "values" key but it works the same way. It's just Record<bcp_string, string> as in `gloss: { "en": "dog", "es": "perro" }` - is there a good reason to nest under values beside leaving room for adding notes or something in the future? What is the reason for the "values" key? As I expand our use of this MultiString idea, I'd like to know more about your experience here.
}

interface WritingSystem {
  id: WritingSystemId
  name: string
  abbreviation: string
  font: string
}

interface WritingSystems {
  analysis: WritingSystem[] // let's pretend I'm studying a Native American language. This could be English and Spanish for example...
  vernacular: WritingSystem[] // and this might be Latin script and a native script?
}

type WritingSystemId = string

export interface ILexboxApiHub {
  GetWritingSystems: () => Promise<WritingSystems>
  GetEntries: (options: QueryOptions) => Promise<Entry[]>
  SearchEntries: (query: string, options: QueryOptions) => Promise<Entry[]>
  GetEntry: (id: string) => Promise<Entry>
  CreateEntry: (entry: Entry) => Promise<Entry>
  UpdateEntry: (id: string, update: JsonOperation[]) => Promise<Entry>
  DeleteEntry: (id: string) => Promise<void>
  CreateSense: (entryId: string, sense: Sense) => Promise<Sense>
  UpdateSense: (entryId: string, senseId: string, update: JsonOperation[]) => Promise<Sense>
  DeleteSense: (entryId: string, senseId: string) => Promise<void>
  CreateExampleSentence: (entryId: string, senseId: string, exampleSentence: ExampleSentence) => Promise<ExampleSentence>
  UpdateExampleSentence: (entryId: string, senseId: string, exampleSentenceId: string, update: JsonOperation[]) => Promise<ExampleSentence>
  DeleteExampleSentence: (entryId: string, senseId: string, exampleSentenceId: string) => Promise<void>
}

interface QueryOptions {
  order: string
  count: number
  offset: number
}

interface JsonOperation {
  do_no_know_yet: string
}
