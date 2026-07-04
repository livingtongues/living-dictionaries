/**
 * Builds bucket-assignments.csv from /tmp/dict-stats.jsonl (see
 * .issues/dictionary-buckets-cleanup.md). Deterministic rules + hand-reviewed
 * override lists (Claude judgment pass, 2026-07-04).
 *
 * Buckets: public | unlisted | secure | conlang | glossary | delete
 * Rules:
 *   1. public = 1                          → public
 *   2. entries ≤ 3 AND stale ≥ 1yr         → delete   (content activity only)
 *   3. conlang-marked (con_language_description) → conlang, minus rescues
 *   4. everything else                     → unlisted, minus overrides
 * Activity = max(created_at, entry created range, content writes after the
 * 2025-05-13 bulk re-stamp). Stale 4–10-entry junk was hand-moved to delete.
 */
import fs from 'node:fs'
import path from 'node:path'
const __dirname = new URL('.', import.meta.url).pathname

const STATS_PATH = process.argv[2] || '/tmp/dict-stats.jsonl'
const RESTAMP = '2025-05-14'
const YEAR_AGO = '2025-07-04'

const rows = fs.readFileSync(STATS_PATH, 'utf8').trim().split('\n').map(line => JSON.parse(line))

const conlang_marked = row => row.con_language_description && row.con_language_description.trim() !== ''
function last_activity(row) {
  const candidates = [row.created_at, row.first_entry_at, row.last_entry_created_at]
  if (row.last_content_at && row.last_content_at >= RESTAMP)
    candidates.push(row.last_content_at)
  return candidates.filter(Boolean).sort().pop()
}

// ---------------------------------------------------------------------------
// Hand-review override lists (ids). See the issue file for methodology.
// ---------------------------------------------------------------------------

/** Conlang-marked but actually REAL language documentation (old form stored denials). */
const C_RESCUE_UNLISTED = ['kalenjin', 'honduras-garifuna', 'tseltal', 'ksingmul', 'dargwa-mugi', 'dargwa-gapshima', 'dargwa-kadar', 'itsari', 'mehweb', 'dargwa-gubden', 'chirag', 'kubachi', 'euskara-basque', 'tanacross', 'galo', 'tsafiki', 'luo', 'biloxi', 'holikachuk', 'nyishi', 'bahasa-suku-ngalik', 'kayan-baram', 'tongan', 'tillamook', 'hanunuo', 'kodava', 'fino-takmori', 'tipra-kok-ni-english-kok', 'desert-cahuilla', 'jicarilla-apache', 'wancho-dictionary', 'guanche', 'creol-taal', 'puquina', 'yorùbá', 'lucumi', 'tsimane', 'vedda-reconstruct', 'tuvalu', 'cuitlateco', 'makalero', 'palero', 'sumerian', 'tamil', 'wounaan', 'baltiskat', 'ekari', 'siculo-arberesh', 'gaulish', 'wiradjuri', 'chipileno', 'massa', 'miluk', 'rromay', 'khroskyabs', 'raji', '-runglwo', 'mararit', 'saulteaux', 'uma-baha', 'karenleke', 'xitsonga', 'gosavi', 'dangme-english-dictionary', 'mai-coca-zio-bian', 'proto-indo-european']

/** Conlang-marked but actually a wordlist/study/terminology/test glossary. */
const C_TO_GLOSSARY = ['---saphorndict', 'pet', 'pharm-tech-abbreviations', 'swedishandspanish', 'english-for-pa', 'english-idioms', 'oauslangs', 'lil3ilm-dictionary', 'harry-poter-spells-charms', 'formas-de-referirse-a-las', 'espanol-del-caribe-colomb', 'espanol', 'santanderianismos', 'roaviation', 'kitanese', 'lara', 'test-language-x', 'deutch', 'clothes-idioms', 'espanolsoezcol', 'diccionario-de-insultos', 'regionalismoshuilenses', 'diccionario-de-valorant', 'jovenesestudiantes', 'lexicon-del-sabanero', 'espanolenterprise-resourc', 'slang', 'expresionesfrases-de-amo', 'muisquismos-en-el-espanol', 'hablajuvenilredesecuador', 'test12345', 'testomatico', 'testing', 'biol3660summer2026', 'computerscienceterms', 'english-c1', 'latinenglishdict', 'oau-slangs', 'lexico-del-futbol-colombi', 'vismay-glossary', 'englishmeow', 'brainrot-dictionary', 'dublin-slang', 'vocabualry-set-global-suc', 'diccionarioowen', 'english-for-pet', 'joshua-koenig-ottmann-dic', '77chinese-dictionary', 'arabic-and-english', 'childrens-dictionary', 'chinese-idiom-with-canton', 'chinese-idioms', 'chineseidiomdictionary', 'chineseremivocab', 'chineseversionidiom', 'dandra-management-dictio', 'dictionary-of-fashion-in', 'economics-terms', 'emmas-english', 'english-indonesia', 'english-vietnamese', 'english123', 'englishcom', 'englishvocabulary', 'erins-norwegian-dictiona', 'gagner', 'gen-aloha-slang', 'gio-english', 'humss-vocabulary', 'medical-terms-in-english', 'mitchells-dictionary', 'new-english-dating-terms', 'new-slang', 'omtobaenglish', 'the-tiktok-slang-for-gran', 'thebookofprophecytbop', 'w-dictionary', 'a-mini-dictionary-of-comm', 'andorran-dictionary', 'dictionary-of-traditional', 'food-names-english', 'football-terms-dictionary', 'frenchtoenglish', 'goofy-terms', 'japanese-uzbek-english', 'old-englishdictonary', 'social-studies-dictionary', 'the-2025-world-scholars-c', 'everyone-understands-adri', 'gen-z-alpha-dictionary']

/** Conlang-marked stale test dicts → delete. */
const C_TO_DELETE = ['test1234', 'test-wiznura']

/** Gray-zone → conlang (invented languages, fictional, friend-group made-up). */
const D_TO_CONLANG = ['norsii', 'bositican', 'lycraeas', 'may-lumi', 'skypien', 'santanish', 'pawl', 'lesnian', 'karrffirrafat', 'quaternarion', 'akranzitian', 'boonuage', 'sholonese', 'berglish', 'karf', 'francais-kawakamique', 'loganese', 'ramiuese', 'dragconal', 'ḍaichyian', 'nadurian', 'symes', 'puyallup-english', 'palus', 'ancient-language', 'inglis-diksionari', 'krekozhan', 'naravana', 'newspeak-dictionary', 'whujian', 'intriguish', 'baguettish', 'ryazian', 'pephan', 'keety', 'ling', 'logoian', 'peener', 'serta-des', 'comosach', 'crimtionary', 'olivish', 'toki-pona-language', 'aarabah', 'aklandictionary', 'arvelonnian', 'artensla', 'burgerion', 'cma-stary', 'devonian', 'dragonic', 'emperiam', 'erin', 'evablo', 'fingouese', 'gooish', 'hashaqte', 'hattof', 'mcgriddle', 'more-words-english', 'olim', 'selinish', 'solenai', 'tayen', 'udrean', 'vincentish', 'wespulse-tool', 'dictionary-of-alternate-v', 'dojowara', 'anglow-norman-kreeool', 'anthrow', 'beyond-the-frontier', 'chachamba', 'francais-germanie', 'grit', 'hawkdenish', 'lotons', 'lotons-rus', 'lutariense', 'nathanielewilliamese-obo', 'new-gagweem', 'noratherai', 'buddhijkyesyes', 'milangrusia', 'nederlian', 'aitian', 'harder-english', 'farenic', 'caspian', 'god-is-goo']

/** Gray-zone → glossary (learner lists, class projects, slang/terminology inventories, tests). */
const D_TO_GLOSSARY = ['espanol-a1', 'english-dictionary', 'english', 'aprendendofrances', 'unit-3-an-ace-up-the-sle', 'unit-2-dream-factories', 'the-lions-share', 'unit1constitution', 'unit-2-weather-or-not', 'unit-1-crown-thy-gold-wi', 'korean', 'lgbt-inary', 'te-riu-roa-papa-kupu', 'twoa-kupu', 'unit-3-airports', 'animalslanguage', 'deutsch', 'englishfavortiewords', 'e-bible-mini-dictionary', 'engslish', 'emotionsof-heart', 'english-20', 'vismay-international-corp', 'cevonunb2si', 'diccionav', 'mini-diccionario-ilustrad', 'espanol-gastronomico-de-c', 'weatherlanguage', 'hanna', 'prendas-de-vestir', 'lenana', 'amor-infidelidad', 'girlangue-ghana', 'espanol-', 'lengua-espanola', 'english-phrasebook--', 'filipinostudy', 'short-ways-to-say-stuff', 'insultos-esp-col-med', 'ecco', 'glosario-de-coloquialismo', 'habla-coloquial-de-cd-ju', 'repertorio-pueblerino', 'term-academica-panhisp', 'gen-z-american-english', 'dictionary-of-olympic-spo', 'giver', 'variacion-lexica-en-joven', 'chinese-simplified-levani', 'lexico-asodatrapobulleren', 'variacion-lexica-juvenil', 'colombianismosquechua', 'english-slang-dictonary-f', 'glosario-de-terminos-util', 'hablacoloquialbumanguesa', 'dictionary-of-animal-name', 'animal-names-in-yoruba', 'yavapai', 'glosariocoloquialismopesc', 'diccionario-del-espanol', 'gen-z-1997-2009-and-gen', 'mandarin-practice', 'mpag', 'tagalog', 'example-v4-senses', 'espanol-portugues', 'frances', 'naffa-brainrot', 'elhosiny', 'te-reo', 'the-auden-dictionary', 'babywearing', 'diccionario-semiotico', 'edu', 'swedish', 'chicken-language', 'chinese-dictionary', 'chinese-idiom', 'chinese-idiom-dictationar', 'chinese-idiom-dictionary', 'chinese-idioms-dictionary', 'chinese-idioms-video-dict', 'chineseidiomdictionary1', 'chinglish', 'corporate-performance', 'dasc-dictionary-box', 'dfdfd', 'el-espanol', 'eng', 'englis', 'english-idiom-video-dicti', 'english-world', 'enlgish', 'example', 'family', 'french-random-voc', 'german', 'harry-potter-magic-spell', 'idiom-in-chinese', 'inclusive-language', 'irishdictionary', 'italiano', 'jezyk-grecki', 'lottes-dictionary', 'machodictionary', 'maddys-deutsch-dictionary', 'middle-english', 'mini-espanol', 'olympic-sports-encycloped', 'opo-acronyms', 'ozbekce-sozluk', 'prisnal-finenaces', 'reading', 'sadf', 'spanishdict8th', 'sporty', 'sude-menemen-sozluksel', 'the-buv-dialect', 'trustworthy', 'tudientinhoc', 'verbarium', 'wielki-silly-slownik-pier', 'witches-tongue', 'alpha-gen', 'abc', 'arabic--e-kamus-', 'arabic-networking-terms', 'british-english', 'charts-n-smarts', 'nuu-chah-nulth-novel-stud', 'chinese-idiom-video-canto', 'chinese-idiom-video-dicti', 'test-004', 'test-german', 'the-halftonechi-railfan-c', 'toronto', 'trung-viet', 'jacob-test2', 'kaifs-dictionary', 'esahs-live-dictionary', 'economic-dictionary--eng', 'englishvocab', 'ancient-egyptian', 'antik-msrca', 'arabic-thai', 'bridging-bogota--karachi', 'c1vocabulary', 'chicken-languange', 'chinese-idiom-video', 'chinesee', 'dico', 'engcom', 'english20', 'englishlivingdictionaries', 'englishy', 'espanol87420', 'espanolcol', 'finnishlang', 'french', 'harry-potter', 'inside-jokes', 'italian-300', 'jargon', 'kyle', 'legal-words', 'lexis-definitions', 'mini-dictionary', 'my-personal-dictionary', 'new', 'new-gen', 'polish-english-dictionary', 'the-barbie-dictionary', 'this-is-a-test-harry-pot', 'tomibrain01', 'natashadonoh', 'oluwakemi', 'moari', 'norsk', 'tolkapayayavapai']

/** Gray-zone stale 4–10-entry obvious junk / abandoned trivia → delete. */
const D_TO_DELETE = ['amdang', 'franco-chinese', 'hebreo', 'kabardian', 'kului', 'kurdish', 'liangmai', 'nogai05', 'panjabi', 'punjabi', 'walak', 'weri-language', 'yor', 'zapoteco-del-centro', 'numberoligia', 'ho-kaji-sobod', 'diccionario-de-la-amistad', 'mundus-world']

// ---------------------------------------------------------------------------

const override_of = {}
for (const [list, bucket] of [
  [C_RESCUE_UNLISTED, 'unlisted'],
  [C_TO_GLOSSARY, 'glossary'],
  [C_TO_DELETE, 'delete'],
  [D_TO_CONLANG, 'conlang'],
  [D_TO_GLOSSARY, 'glossary'],
  [D_TO_DELETE, 'delete'],
]) {
  for (const id of list) {
    if (override_of[id])
      throw new Error(`duplicate override for ${id}`)
    override_of[id] = bucket
  }
}

// Match on NFC-normalized ids (a few ids carry combining diacritics).
const id_by_nfc = {}
for (const row of rows) id_by_nfc[row.id.normalize('NFC')] = row.id
for (const id of Object.keys(override_of)) {
  const actual = id_by_nfc[id.normalize('NFC')]
  if (!actual)
    throw new Error(`override id not found in stats: ${id}`)
  if (actual !== id) {
    override_of[actual] = override_of[id]
    delete override_of[id]
  }
}

const out = []
const counts = {}
for (const row of rows) {
  let bucket, reason
  const entries = row.entries_count ?? 0
  const stale = last_activity(row) < YEAR_AGO
  if (row.public === 1) {
    bucket = 'public'
    reason = 'publicly listed'
  } else if (entries <= 3 && stale) {
    bucket = 'delete'
    reason = `${entries} entries, stale since ${(last_activity(row) || '').slice(0, 10)}`
  } else if (override_of[row.id]) {
    bucket = override_of[row.id]
    reason = 'hand-reviewed'
  } else if (conlang_marked(row)) {
    bucket = 'conlang'
    reason = 'self-declared conlang'
  } else {
    bucket = 'unlisted'
    reason = 'default real private'
  }
  counts[bucket] = (counts[bucket] || 0) + 1
  out.push([row.id, bucket, reason])
}

const csv = `dictionary_id,bucket,reason\n${out.map(([id, bucket, reason]) => `"${id}",${bucket},"${reason}"`).join('\n')}\n`
fs.writeFileSync(path.join(__dirname, 'bucket-assignments.csv'), csv)
console.log(counts)
console.log(`wrote ${out.length} assignments to bucket-assignments.csv`)
