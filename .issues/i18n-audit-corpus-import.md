# AI i18n audit — corpus and imports

## Scope and method

- Production rows only, queried read-only from `/data/shared.db` on 2026-07-22.
- Review every active `needs_review = 'ai'` row in these key sections, grouping all 18 locales by English key so shared UI meaning stays consistent: `discourse`, `import_page`, `sentence`, `source`, `text`, and `text_tag`.
- Inspect each key's concrete call site before judging it. Flag only substantive mistranslations, misleading terminology, broken placeholders, omissions, or UI-context errors—not harmless stylistic alternatives.
- Draft the eight missing `import_page` keys for every locale without modifying production or committed locale files.

## Coverage

| Section | English keys with pending AI rows | Pending rows |
|---|---:|---:|
| `discourse` | 8 | 144 |
| `import_page` | 26 | 452 |
| `sentence` | 11 | 166 |
| `source` | 30 | 539 |
| `text` | 22 | 396 |
| `text_tag` | 9 | 162 |
| **Total** | **106** | **1,859** |

The eight absent `import_page` keys are excluded from the 452 pending rows above; together they require 144 new drafts (8 keys × 18 locales).

## Substantive corrections

### Bibliographic “citation” terminology (high confidence)

`source.citation` is the label of a bibliographic source-record field; `source.slug_required`
points users back to that same field, and `import_page.source_placeholder` gives the concrete example
`Smith, J. (1979). A Dictionary of …`. The following rows currently mean a quotation/excerpt rather
than a bibliographic reference. Each proposed change deliberately fixes all three strings as one
terminology unit.

| Key(s) | English · UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|
| `source.citation`<br>`source.slug_required`<br>`import_page.source_placeholder` | Citation; slug validation; full-reference import placeholder | sw | `Dondoo`<br>`Slug inahitajika (ongeza kifupi au dondoo).`<br>`Nyenzo hii inatoka wapi? k.m. Smith, J. (1979). A Dictionary of …. Ukiacha hii wazi, tutaandika dondoo bora tuwezavyo.` | `Rejeleo la bibliografia`<br>`Slug inahitajika (ongeza kifupi au rejeleo la bibliografia).`<br>`Nyenzo hii inatoka wapi? k.m. Smith, J. (1979). A Dictionary of …. Ukiacha hii wazi, tutaandika rejeleo la bibliografia kadiri tuwezavyo.` | `Dondoo` is an excerpt/quotation, not the complete bibliographic reference shown by the example. |
| same three | same context | he | `מובאה`<br>`נדרש מזהה (הוסף קיצור או מובאה).`<br>`מאיפה החומר הזה? לדוגמה: Smith, J. (1979). A Dictionary of …. אם תשאיר ריק, נכתוב ציטוט כמיטב יכולתנו.` | `הפניה ביבליוגרפית`<br>`נדרש מזהה (יש להוסיף קיצור או הפניה ביבליוגרפית).`<br>`מאיפה החומר הזה? לדוגמה: Smith, J. (1979). A Dictionary of …. אם השדה יישאר ריק, נכתוב הפניה ביבליוגרפית כמיטב יכולתנו.` | `מובאה` is a quoted passage; the placeholder's `ציטוט` is also ambiguous here. |
| same three | same context | id | `Kutipan`<br>`Slug diperlukan (tambahkan singkatan atau kutipan).`<br>`Dari mana materi ini berasal? mis. Smith, J. (1979). A Dictionary of …. Jika dibiarkan kosong, kami akan membuat sitasi sebaik mungkin.` | `Sitasi bibliografis`<br>`Slug diperlukan (tambahkan singkatan atau sitasi bibliografis).`<br>`Dari mana materi ini berasal? mis. Smith, J. (1979). A Dictionary of …. Jika dibiarkan kosong, kami akan membuat sitasi bibliografis sebaik mungkin.` | `Kutipan` means a quotation; the placeholder already uses the correct `sitasi`, so the three rows currently disagree. |
| same three | same context | ms | `Petikan`<br>`Slug diperlukan (tambah singkatan atau petikan).`<br>`Dari manakah bahan ini datang? cth. Smith, J. (1979). A Dictionary of …. Jika anda biarkan kosong, kami akan tulis sitasi sebaik mungkin.` | `Rujukan bibliografi`<br>`Slug diperlukan (tambah singkatan atau rujukan bibliografi).`<br>`Dari manakah bahan ini datang? cth. Smith, J. (1979). A Dictionary of …. Jika dibiarkan kosong, kami akan menulis rujukan bibliografi sebaik mungkin.` | `Petikan` is an excerpt/quotation; the full-reference example calls for a bibliographic reference. |
| same three | same context | bn | `উদ্ধৃতি`<br>`একটি স্লাগ প্রয়োজন (একটি সংক্ষিপ্ত রূপ বা উদ্ধৃতি যোগ করুন)।`<br>`এই উপকরণ কোথা থেকে এসেছে? যেমন Smith, J. (1979). A Dictionary of …. ফাঁকা রাখলে আমরা যথাসাধ্য উদ্ধৃতি লিখে দেব।` | `গ্রন্থপঞ্জিগত তথ্য`<br>`একটি স্লাগ প্রয়োজন (একটি সংক্ষিপ্ত রূপ বা গ্রন্থপঞ্জিগত তথ্য যোগ করুন)।`<br>`এই উপকরণ কোথা থেকে এসেছে? যেমন Smith, J. (1979). A Dictionary of …. ফাঁকা রাখলে আমরা যথাসাধ্য গ্রন্থপঞ্জিগত তথ্য লিখে দেব।` | `উদ্ধৃতি` commonly denotes a quotation; the field stores author/year/title information. |
| same three | same context | as | `উদ্ধৃতি`<br>`এটা স্লাগ প্ৰয়োজন (এটা সংক্ষিপ্ত ৰূপ বা উদ্ধৃতি যোগ কৰক)।`<br>`এই সামগ্ৰী ক’ৰ পৰা আহিছে? যেনে: Smith, J. (1979). A Dictionary of …. খালী ৰাখিলে আমি যথাসম্ভৱ উদ্ধৃতি লিখিম।` | `গ্ৰন্থপঞ্জীয় তথ্য`<br>`এটা স্লাগ প্ৰয়োজন (এটা সংক্ষিপ্ত ৰূপ বা গ্ৰন্থপঞ্জীয় তথ্য যোগ কৰক)।`<br>`এই সামগ্ৰী ক’ৰ পৰা আহিছে? যেনে: Smith, J. (1979). A Dictionary of …. খালী ৰাখিলে আমি যথাসম্ভৱ গ্ৰন্থপঞ্জীয় তথ্য লিখিম।` | `উদ্ধৃতি` suggests a quotation, not the bibliographic record shown in the example. |
| same three | same context | hi | `उद्धरण`<br>`एक स्लग आवश्यक है (एक संक्षिप्त रूप या उद्धरण जोड़ें)।`<br>`यह सामग्री कहाँ से आई है? उदा. Smith, J. (1979). A Dictionary of …. यदि आप इसे खाली छोड़ते हैं, तो हम यथासंभव उद्धरण लिखेंगे।` | `ग्रंथसूची संदर्भ`<br>`एक स्लग आवश्यक है (एक संक्षिप्त रूप या ग्रंथसूची संदर्भ जोड़ें)।`<br>`यह सामग्री कहाँ से आई है? उदा. Smith, J. (1979). A Dictionary of …. यदि आप इसे खाली छोड़ते हैं, तो हम यथासंभव ग्रंथसूची संदर्भ लिखेंगे।` | `उद्धरण` is a quotation; this is a bibliographic-reference field. |
| same three | same context | ha | `Nassi`<br>`Ana buƙatar slug (ƙara gajarce ko nassi).`<br>`A ina wannan abu ya fito? misali. Smith, J. (1979). A Dictionary of …. Idan kun bar wannan babu komai, za mu rubuta ambaton gwargwadon iyawarmu.` | `Bayanan tushe`<br>`Ana buƙatar slug (ƙara gajarce ko bayanan tushe).`<br>`Daga ina wannan abu ya fito? misali: Smith, J. (1979). A Dictionary of …. Idan aka bar wannan babu komai, za mu rubuta bayanan tushe gwargwadon iyawarmu.` | `Nassi` is a quoted text/passage; “source details” accurately describes the author/year/title field without a risky specialist loanword. |
| same three | same context | am | `ጥቅስ`<br>`Slug ያስፈልጋል (ምህጻረ ቃል ወይም ጥቅስ ያክሉ)።`<br>`ይህ ቁሳቁስ ከየት ነው የመጣው? ለምሳሌ፦ Smith, J. (1979). A Dictionary of …. ባዶ ቢተዉት፣ እኛ በተቻለን መጠን ጥቅስ እንጽፋለን።` | `የማጣቀሻ መረጃ`<br>`Slug ያስፈልጋል (ምህጻረ ቃል ወይም የማጣቀሻ መረጃ ያክሉ)።`<br>`ይህ ቁሳቁስ ከየት ነው የመጣው? ለምሳሌ፦ Smith, J. (1979). A Dictionary of …. ባዶ ቢተዉት፣ በተቻለን መጠን የማጣቀሻ መረጃ እንጽፋለን።` | `ጥቅስ` means a quotation; “reference information” matches the actual data. |
| same three | same context | or | `ଉଦ୍ଧୃତି`<br>`ଏକ ସ୍ଲଗ୍ ଆବଶ୍ୟକ (ଏକ ସଂକ୍ଷିପ୍ତ ରୂପ କିମ୍ବା ଉଦ୍ଧୃତି ଯୋଗ କରନ୍ତୁ)।`<br>`ଏହି ସାମଗ୍ରୀ କେଉଁଠୁ ଆସିଛି? ଯଥା Smith, J. (1979). A Dictionary of …. ଯଦି ଖାଲି ଛାଡ଼ନ୍ତି, ଆମେ ଯଥାସମ୍ଭବ ଏକ ଉଦ୍ଧୃତି ଲେଖିବୁ ।` | `ଗ୍ରନ୍ଥସୂଚୀୟ ସନ୍ଦର୍ଭ`<br>`ଏକ ସ୍ଲଗ୍ ଆବଶ୍ୟକ (ଏକ ସଂକ୍ଷିପ୍ତ ରୂପ କିମ୍ବା ଗ୍ରନ୍ଥସୂଚୀୟ ସନ୍ଦର୍ଭ ଯୋଡ଼ନ୍ତୁ)।`<br>`ଏହି ସାମଗ୍ରୀ କେଉଁଠୁ ଆସିଛି? ଯଥା Smith, J. (1979). A Dictionary of …. ଯଦି ଖାଲି ଛାଡ଼ନ୍ତି, ଆମେ ଯଥାସମ୍ଭବ ଏକ ଗ୍ରନ୍ଥସୂଚୀୟ ସନ୍ଦର୍ଭ ଲେଖିବୁ।` | `ଉଦ୍ଧୃତି` is a quotation; the example is a bibliographic reference. |

### Other high-confidence corrections

| Key | English · UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|
| `text.resplit_warning` | Going back re-splits… · destructive confirmation on the text-ingest adjust step | de | `Wenn Sie zurückgehen, wird aus dem eingefügten Text neu aufgeteilt und Ihre Satzanpassungen werden verworfen. Fortfahren?` | `Wenn Sie zurückgehen, wird der eingefügte Text erneut in Sätze aufgeteilt und Ihre Satzanpassungen werden verworfen. Fortfahren?` | The current clause is grammatically incomplete (`wird aus dem … aufgeteilt`) and omits what is re-split. |
| `source.choose_speaker_instead` | Know the speaker? · switch from source attribution to a language speaker | pt | `Conhece o orador? Escolha um orador em vez disso` | `Conhece o falante? Escolha um falante em vez disso` | `orador` is a public speaker/orator; this app consistently calls a language informant `falante`. |
| `source.cite_instead` | Speaker unknown? Cite a source instead · same switch | pt | `Orador desconhecido? Cite uma fonte em vez disso` | `Falante desconhecido? Cite uma fonte em vez disso` | Same domain error as above. |
| `source.used_by` | Used by · numeric count of entry/sentence/text references in the sources table | zh | `使用者` | `被引用数` | Current means “users/persons who use it,” not the number of data records referencing the source. |
| `source.type_corpus` | Corpus · bibliographic source-type option | sw | `Mkondo` | `Kongoo` | `Mkondo` is a stream/course. `Kongoo` is the terminology used by [BAKITA's national Swahili corpus system](https://kongoo.bakita.go.tz/). |
| `source.type_corpus` | Corpus · bibliographic source-type option | ha | `Rukuni` | `Tarin matani` | Current means a group/category; the proposal explicitly means a collection of texts. |
| `source.type_hymnal` | Hymnal · bibliographic source-type option | ha | `Waƙoƙin ibada` | `Littafin waƙoƙin ibada` | Current means worship songs, omitting that the source is the songbook/hymnal itself. |
| `source.type_phrasebook` | Phrasebook · bibliographic source-type option | ha | `Littafin jumla` | `Littafin jimloli` | Current says a book of one “sentence”; the plural correctly describes a phrase/sentence collection. |
| `source.type_primer` | Primer · bibliographic source-type option | vi | `Sách giáo khoa cơ bản` | `Sách vỡ lòng` | Current is a generic basic textbook; the proposal is the specific term for a beginning primer. |
| `source.license` | License · source metadata field | as | `লাইচেঞ্চ` | `লাইচেন্স` | Misspelling/transliteration error (“licench” rather than “license”). |
| `import_page.any_format_body` | Import service description · “read your materials and bring them in” means import their data | he | `גיליונות אלקטרוניים, מסמכי Word, ייצואי FLEx או LIFT, קבצי Toolbox/Shoebox, Lexique Pro, ELAN, גיבויי מסדי נתונים ישנים — אפילו סריקות PDF של מילונים מודפסים. ללא יוצאים מן הכלל. הצוות שלנו משתמש בכלי AI עם בדיקה אנושית כדי לקרוא את החומרים שלך ולהביא אותם פנימה, כך שלעולם אין צורך לעצב מחדש שום דבר.` | `גיליונות אלקטרוניים, מסמכי Word, ייצואי FLEx או LIFT, קבצי Toolbox/Shoebox, Lexique Pro, ELAN, גיבויי מסדי נתונים ישנים — אפילו סריקות PDF של מילונים מודפסים. ללא יוצאים מן הכלל. הצוות שלנו משתמש בכלי AI עם בדיקה אנושית כדי לקרוא את החומרים שלך ולייבא אותם, כך שלעולם אין צורך לשנות את הפורמט שלהם.` | `להביא אותם פנימה` is the literal physical “bring them inside,” not data import. |
| `import_page.any_format_body` | same | bn | `স্প্রেডশিট, ওয়ার্ড ডকুমেন্ট, FLEx বা LIFT এক্সপোর্ট, Toolbox/Shoebox ফাইল, Lexique Pro, ELAN, পুরনো ডেটাবেস ব্যাকআপ — এমনকি মুদ্রিত অভিধানের PDF স্ক্যান। কোনো ব্যতিক্রম নেই। আমাদের দল AI সরঞ্জাম ব্যবহার করে মানব পর্যালোচনাসহ আপনার উপকরণ পড়ে নিয়ে আসে, তাই কিছু পুনর্গঠন করতে হবে না।` | `স্প্রেডশিট, ওয়ার্ড ডকুমেন্ট, FLEx বা LIFT এক্সপোর্ট, Toolbox/Shoebox ফাইল, Lexique Pro, ELAN, পুরনো ডেটাবেস ব্যাকআপ — এমনকি মুদ্রিত অভিধানের PDF স্ক্যানও। কোনো ব্যতিক্রম নেই। আমাদের দল মানব পর্যালোচনাসহ AI সরঞ্জাম ব্যবহার করে আপনার উপকরণ পড়ে সেগুলোর তথ্য ইম্পোর্ট করে, তাই আপনাকে কিছুই পুনরায় ফরম্যাট করতে হবে না।` | Current literally says the team “reads and brings” the materials and weakens “reformat” to generic reconstruction. |
| `import_page.any_format_body` | same | as | `স্প্ৰেডশ্বীট, ৱৰ্ড ডকুমেণ্ট, FLEx বা LIFT এক্সপ’ৰ্ট, Toolbox/Shoebox ফাইল, Lexique Pro, ELAN, পুৰণি ডাটাবেছ বেকআপ — এনে কি মুদ্ৰিত অভিধানৰ PDF স্কেন। ব্যতিক্ৰম নাই। আমাৰ দলে AI সঁজুলি আৰু মানৱ পৰ্যালোচনা ব্যৱহাৰ কৰি আপোনাৰ সামগ্ৰী পঢ়ি আনে, সেয়ে আপুনি একো পুনৰ ফৰ্মেট কৰিব নালাগে।` | `স্প্ৰেডশ্বীট, ৱৰ্ড ডকুমেণ্ট, FLEx বা LIFT এক্সপ’ৰ্ট, Toolbox/Shoebox ফাইল, Lexique Pro, ELAN, পুৰণি ডাটাবেছ বেকআপ — আনকি মুদ্ৰিত অভিধানৰ PDF স্কেনো। কোনো ব্যতিক্ৰম নাই। আমাৰ দলে মানৱ পৰ্যালোচনাসহ AI সঁজুলি ব্যৱহাৰ কৰি আপোনাৰ সামগ্ৰী পঢ়ি তাৰ তথ্য আমদানি কৰে, সেয়ে আপুনি একো পুনৰ ফৰ্মেট কৰিব নালাগে।` | Current says the team “reads and brings” the materials, not imports their data. |
| `import_page.any_format_body` | same | hi | `स्प्रेडशीट्स, वर्ड डॉक्यूमेंट्स, FLEx या LIFT एक्सपोर्ट्स, Toolbox/Shoebox फ़ाइलें, Lexique Pro, ELAN, पुरानी डेटाबेस बैकअप्स — यहाँ तक कि मुद्रित शब्दकोशों के PDF स्कैन। कोई अपवाद नहीं। हमारी टीम आपके सामग्री को पढ़ने और लाने के लिए मानव समीक्षा सहित AI टूल्स का उपयोग करती है, इसलिए आपको कभी भी कुछ भी रिफॉर्मेट करने की ज़रूरत नहीं पड़ती।` | `स्प्रेडशीट, वर्ड दस्तावेज़, FLEx या LIFT एक्सपोर्ट, Toolbox/Shoebox फ़ाइलें, Lexique Pro, ELAN, पुराने डेटाबेस बैकअप — यहाँ तक कि मुद्रित शब्दकोशों के PDF स्कैन भी। कोई अपवाद नहीं। हमारी टीम मानव समीक्षा के साथ AI टूल का उपयोग करके आपकी सामग्री पढ़ती है और उसका डेटा आयात करती है, इसलिए आपको कभी कुछ दोबारा फ़ॉर्मैट नहीं करना पड़ता।` | Current has the wrong agreement (`आपके सामग्री`) and “bring” instead of data import. |
| `import_page.any_format_body` | same | ha | `Tables, takardun Word, fitar FLEx ko LIFT, fayilolin Toolbox/Shoebox, Lexique Pro, ELAN, tsoffin bayanan bayanai — har ma da duba PDF na ƙamus da aka buga. Babu wani keɓancewa. Ƙungiyarmu tana amfani da kayan aikin AI tare da nazarin ɗan adam don karanta kayan ku da shigo da su, don haka ba za ku taɓa buƙatar sake tsara komai ba.` | `Maƙunsar bayanai, takardun Word, fitar FLEx ko LIFT, fayilolin Toolbox/Shoebox, Lexique Pro, ELAN, tsoffin kwafin ajiyar rumbun bayanai — har ma da hotunan PDF na ƙamus da aka buga. Babu keɓancewa. Ƙungiyarmu tana amfani da kayan aikin AI tare da bitar ɗan adam don karanta kayanku da shigo da bayanansu, don haka ba za ku taɓa buƙatar sake sauya tsarin komai ba.` | Current begins with untranslated “Tables” and mistranslates database backups as repeated “data data.” |
| `import_page.how_step_1` | Upload your resources below… · first instruction step | hi | `नीचे अपनी संसाधन अपलोड करें — कोई भी फ़ाइल, कोई भी फ़ॉर्मेट।` | `नीचे अपने संसाधन अपलोड करें — कोई भी फ़ाइल, कोई भी फ़ॉर्मेट।` | Number/gender agreement error: plural `संसाधन` requires `अपने`, not `अपनी`. |
| `import_page.how_step_2` | For each file… what to focus on, what to leave out · instruction guidance | es | `Para cada archivo, díganos cómo desea importarlo: qué enfocarse, qué omitir.` | `Para cada archivo, díganos cómo desea que lo importemos: en qué debemos enfocarnos y qué debemos omitir.` | `qué enfocarse` is ungrammatical and also loses who will do the focusing/import. |
| `import_page.how_step_2` | same | sw | `Kwa kila faili, tuambie jinsi unavyotaka iingizwe: nini kizingatia, nini kuacha.` | `Kwa kila faili, tuambie jinsi unavyotaka iletwe: mambo ya kuzingatia na mambo ya kuacha.` | `nini kizingatia` is malformed; the proposal restores the parallel “focus on / leave out” instructions. |
| `import_page.request_button` | Request we import this · submit button | fr | `Demander à importer ceci` | `Demander que nous importions ceci` | Current reads as asking for permission to import it oneself; the button asks the team to do it. |
| `import_page.request_button` | same | he | `בקש שניבא את זה` | `בקש שנייבא את זה` | Missing yod changes “import” into “predict/prophesy.” |
| `import_page.request_button` | same | am | `ይህን እናስመጣ በል` | `ይህን እንድናስመጣ ይጠይቁ` | Current is an informal singular “tell [us] to import this,” inconsistent with the polite UI and the meaning of request. |
| `import_page.managers_only` | Access explanation for non-managers | he | `רק מנהלי המילון יכולים להעלות משאבים ולבקש ייבואים. אם מגיע לך גישה, בקש ממנהל של מילון זה להזמין אותך.` | `רק מנהלי המילון יכולים להעלות משאבים ולבקש ייבוא. אם אמורה להיות לך גישה, בקש מאחד ממנהלי המילון להזמין אותך.` | `מגיע לך גישה` is ungrammatical and shifts “should have access” toward “deserve access.” |
| `import_page.managers_only` | same | ha | `Manajojin ƙamus kawai za su iya ɗaukar albarkatu da neman shigo da su. Idan ya kamata ku sami damar, tambayi manajan wannan ƙamus don ɗaukar ku.` | `Manajojin ƙamus kaɗai za su iya loda albarkatu da neman a shigo da su. Idan ya kamata ku sami dama, ku roƙi manajan wannan ƙamus ya gayyace ku.` | Current uses “carry resources” for upload and “take/pick you” for invite. |
| `import_page.requested_files` | Requested resources · heading above grouped import requests | sw | `Nyenzo zilizoomwa` | `Nyenzo zilizoombwa` | Spelling error drops the `b` from “requested.” |
| `import_page.self_serve_body` | Optional AI-agent self-import instructions | he | `אם אתה נוח עם סוכן קידוד AI (כמו Claude Code או Codex), תוכל לדלג על ההמתנה: צור מפתח API בדף הסוכנים ותן לסוכן שלך לקרוא את הקבצים שלך ולייבא את הנתונים ישירות דרך ה-API שלנו.` | `אם נוח לך לעבוד עם סוכן תכנות מבוסס AI (כמו Claude Code או Codex), אפשר לדלג על ההמתנה: יש ליצור מפתח API בדף Agents ולתת לסוכן לקרוא את הקבצים ולייבא את הנתונים ישירות דרך ה-API שלנו.` | `אם אתה נוח עם` is not idiomatic Hebrew (“if you are physically comfortable with”); the proposal states comfort working with the tool. |
| `import_page.self_serve_body` | same | vi | `Nếu bạn thoải mái với tác nhân mã hóa AI (như Claude Code hoặc Codex), bạn có thể bỏ qua thời gian chờ: tạo khóa API trên trang Tác nhân và để tác nhân của bạn đọc tệp của bạn và nhập dữ liệu trực tiếp qua API của chúng tôi.` | `Nếu bạn quen dùng một tác nhân lập trình AI (như Claude Code hoặc Codex), bạn có thể bỏ qua thời gian chờ: tạo khóa API trên trang Agents và để tác nhân đọc các tệp rồi nhập dữ liệu trực tiếp qua API của chúng tôi.` | `tác nhân mã hóa` is an encoding agent, not a coding/programming agent. |
| `import_page.instructions_placeholder` | Example import instructions · “glosses” are dictionary senses/short meanings, not annotations | zh | `例如：导入所有条目及其例句。注释为西班牙语。跳过引言页。` | `例如：导入所有条目及其例句。释义为西班牙语。跳过引言页。` | `注释` means annotations/comments; `释义` is the dictionary meaning/gloss. |
| `import_page.instructions_placeholder` | same | sw | `k.m. Leta maingizo yote pamoja na sentensi za mfano. Tafsiri ziko kwa Kihispania. Ruka kurasa za utangulizi.` | `k.m. Leta maingizo yote pamoja na sentensi za mfano. Glosi ziko kwa Kihispania. Ruka kurasa za utangulizi.` | “Translations” loses the field-specific gloss concept used by the import instructions. |
| `import_page.instructions_placeholder` | same | he | `לדוגמה: ייבא את כל הערכים עם משפטי הדוגמה שלהם. התרגומים בספרדית. דלג על עמודי המבוא.` | `לדוגמה: ייבא את כל הערכים עם משפטי הדוגמה שלהם. הגלוסות בספרדית. דלג על עמודי המבוא.` | Current says general translations; this refers specifically to entry glosses. |
| `import_page.instructions_placeholder` | same | ar | `مثال: استورد جميع المدخلات مع جملها التوضيحية. الترجمات بالإسبانية. تخطَّ صفحات المقدمة.` | `مثال: استورد جميع المدخلات مع جملها التوضيحية. شروح الكلمات بالإسبانية. تخطَّ صفحات المقدمة.` | Current says general translations rather than short word glosses. |
| `import_page.instructions_placeholder` | same | vi | `ví dụ: Nhập tất cả mục từ cùng với câu ví dụ của chúng. Các chú thích bằng tiếng Tây Ban Nha. Bỏ qua các trang giới thiệu.` | `ví dụ: Nhập tất cả mục từ cùng với câu ví dụ của chúng. Nghĩa từ bằng tiếng Tây Ban Nha. Bỏ qua các trang giới thiệu.` | `chú thích` means notes/annotations; the data field is the word meaning/gloss. |
| `import_page.instructions_placeholder` | same | ha | `misali. Shigo da duk shigarwa tare da jumla misali. Glosses a cikin Spanish. Tsallake shafukan gabatarwa.` | `misali: Shigo da duk shigarwar tare da jimlolin misali. Ma’anonin kalmomin suna cikin Sifaniyanci. Tsallake shafukan gabatarwa.` | Current leaves “Glosses” and “Spanish” untranslated and has singular agreement errors. |

### Literal “follow up” translations (high confidence)

In `how_step_3` and `request_sent`, “follow up with you by email” means **contact you again**, not
physically follow or track the user. These paired replacements keep the promise identical before and
after submission.

| Key(s) | English · UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|
| `import_page.how_step_3`<br>`import_page.request_sent` | Press Request import… follow up by email; Request sent… follow up by email | sw | `Bonyeza “Request import” — timu yetu huanza kazi na inakufuata kupitia barua pepe.`<br>`Ombi limetumwa! Timu yetu itakufuata kupitia barua pepe.` | `Bonyeza “Omba kuleta” — timu yetu itaanza kazi na kuwasiliana nawe kwa barua pepe.`<br>`Ombi limetumwa! Timu yetu itawasiliana nawe kwa barua pepe.` | `inakufuata` literally says the team follows/tracks the user. |
| same two | same context | he | `לחץ על “בקש ייבוא” — הצוות שלנו מתחיל לעבוד ועוקב אחריך בדוא"ל.`<br>`הבקשה נשלחה! הצוות שלנו יעקוב אחריך בדוא"ל.` | `לחץ על “בקש ייבוא” — הצוות שלנו יתחיל לעבוד וייצור איתך קשר בדוא״ל.`<br>`הבקשה נשלחה! הצוות שלנו ייצור איתך קשר בדוא״ל.` | `עוקב אחריך` means follows/tracks you. |
| same two | same context | as | `“আমদানিৰ অনুৰোধ কৰক” টিপক — আমাৰ দল কামত লাগে আৰু ইমেইলেৰে আপোনাক অনুসৰণ কৰে।`<br>`অনুৰোধ পঠোৱা হ’ল! আমাৰ দলে ইমেইলেৰে আপোনাক অনুসৰণ কৰিব।` | `“আমদানিৰ অনুৰোধ কৰক” টিপক — আমাৰ দলে কাম আৰম্ভ কৰি ইমেইলযোগে আপোনাৰ সৈতে যোগাযোগ কৰিব।`<br>`অনুৰোধ পঠোৱা হ’ল! আমাৰ দলে ইমেইলযোগে আপোনাৰ সৈতে যোগাযোগ কৰিব।` | `অনুসৰণ` is literal following; `যোগাযোগ` is contact. |
| same two | same context | ha | `Danna “Nemi shigo da” — ƙungiyarmu ta fara aiki kuma ta bi ku ta imel.`<br>`An aika buƙatar! Ƙungiyarmu za ta bi ku ta imel.` | `Danna “Nemi shigo da” — ƙungiyarmu za ta fara aiki kuma ta tuntuɓe ku ta imel.`<br>`An aika buƙatar! Ƙungiyarmu za ta tuntuɓe ku ta imel.` | `bi ku` is physically follow you; `tuntuɓe` is contact. |
| same two | same context | am | `“ማስመጣት ጠይቅ” ይጫኑ — ቡድናችን ይሰራልና በኢሜይል ይከታተላል።`<br>`ጥያቄ ተልኳል! ቡድናችን በኢሜይል ይከታተላል።` | `“ማስመጣት ጠይቅ” ይጫኑ — ቡድናችን ሥራውን ይጀምርና በኢሜይል ያገኝዎታል።`<br>`ጥያቄው ተልኳል! ቡድናችን በኢሜይል ያገኝዎታል።` | `ይከታተላል` is follow/track; the proposal says the team will contact the user. |
| same two | same context | or | `“ଆମଦାନି ଅନୁରୋଧ” ଦବାନ୍ତୁ — ଆମ ଦଳ କାମ ଆରମ୍ଭ କରି ଇମେଲରେ ଆପଣଙ୍କୁ ଅନୁସରଣ କରିବ ।`<br>`ଅନୁରୋଧ ପଠାଯାଇଛି! ଆମ ଦଳ ଇମେଲରେ ଆପଣଙ୍କୁ ଅନୁସରଣ କରିବ ।` | `“ଆମଦାନି ଅନୁରୋଧ” ଦବାନ୍ତୁ — ଆମ ଦଳ କାମ ଆରମ୍ଭ କରି ଇମେଲରେ ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରିବ।`<br>`ଅନୁରୋଧ ପଠାଯାଇଛି! ଆମ ଦଳ ଇମେଲରେ ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରିବ।` | `ଅନୁସରଣ` is literal following; `ଯୋଗାଯୋଗ` is contact. |

### Context-dependent terminology to confirm

These are real semantic distinctions, but a specialist translator should confirm the preferred local
term. They are not included in the high-confidence count.

| Key | English · UI context | Locale(s) | Current | Proposed | Why uncertain |
|---|---|---|---|---|---|
| `discourse.reported_speech` | Reported speech · a narrative clause-role alongside storyline/background/flashback; intended as an umbrella that can include directly quoted speech | es, de, sw, ru, he, pt, id, bn, as, hi, vi, ha, am, or | `Discurso indirecto`; `Indirekte Rede`; `Usemi wa taarifa`; `Косвенная речь`; `דיבור עקיף`; `Discurso indireto`; `Ujaran tidak langsung`; `পরোক্ষ উক্তি`; `পৰোক্ষ উক্তি`; `अप्रत्यक्ष कथन`; `Lời dẫn gián tiếp`; `Maganar bayarwa`; `ተዘዋዋሪ ንግግር`; `ପରୋକ୍ଷ ଉକ୍ତି` | `Discurso referido`; `Redewiedergabe`; `Usemi ulioripotiwa`; `Чужая речь`; `דיבור מדווח`; `Discurso relatado`; `Tuturan yang dilaporkan`; `প্রতিবেদিত উক্তি`; `প্ৰতিবেদিত উক্তি`; `वर्णित कथन`; `Lời nói được thuật lại`; `Maganar da aka ruwaito`; `የተዘገበ ንግግር`; `ବର୍ଣ୍ଣିତ ଉକ୍ତି` | Most current rows explicitly mean **indirect** speech. That is a common school-grammar sense of English “reported speech,” but it is narrower than the app's narrative-role use if direct quotation is also tagged here. Confirm the intended English taxonomy before changing all 14. |
| `discourse.flashback` | Flashback · narrative time-role option | hi | `पूर्वदृश्य` | `अतीत-दृश्य` | Current literally means a preview/advance view and can suggest foreshadowing—the opposite time direction. Proposed “past scene” is semantically safe, but a Hindi literary specialist may prefer `पूर्वदीप्ति`. |
| `text_tag.motif` | Motif · folklore text-tag kind, potentially carrying a Thompson/ATU index code | sw, ha, am | `Kijelezo`; `Jigo`; `ጭብጥ` | `Motifu`; `Motif`; `ተደጋጋሚ ጭብጥ` | Current terms mean descriptor/theme rather than a recurring folklore motif. Borrowing/transliteration may be more precise but should be checked for recognizability by local reviewers. |

## New `import_page` drafts

These keys are absent for all 18 translatable locales. The drafts below follow the actual call sites:

- `delete_requested_confirm` begins a browser confirmation sentence; the filename and final `?` are appended in code.
- `dismiss_success` is the accessible label/title of the × button on the green “Request sent” message.
- `edit_metadata` is the pencil-button tooltip for a requested file's import instructions and source.
- `edit_request_note` is a visible button label on an import-request group.
- `request_group` and `request_note` are compact headings.
- `save_changes` / `saving` share the same button while a request note or file metadata is saved.

| Locale | `delete_requested_confirm` | `dismiss_success` | `edit_metadata` | `edit_request_note` | `request_group` | `request_note` | `save_changes` | `saving` |
|---|---|---|---|---|---|---|---|---|
| es | `Eliminar permanentemente este recurso solicitado y notificar a nuestro equipo:` | `Cerrar mensaje de confirmación` | `Editar instrucciones y fuente` | `Editar nota de la solicitud` | `Solicitud de importación` | `Nota de la solicitud` | `Guardar cambios` | `Guardando…` |
| fr | `Supprimer définitivement cette ressource demandée et en informer notre équipe :` | `Fermer le message de confirmation` | `Modifier les instructions et la source` | `Modifier la note de la demande` | `Demande d’importation` | `Note de la demande` | `Enregistrer les modifications` | `Enregistrement…` |
| de | `Diese angeforderte Ressource dauerhaft entfernen und unser Team benachrichtigen:` | `Erfolgsmeldung schließen` | `Anweisungen und Quelle bearbeiten` | `Anfragenotiz bearbeiten` | `Importanfrage` | `Anfragenotiz` | `Änderungen speichern` | `Wird gespeichert…` |
| zh | `永久移除此已请求导入的资源并通知我们的团队：` | `关闭成功消息` | `编辑导入说明和来源` | `编辑请求备注` | `导入请求` | `请求备注` | `保存更改` | `正在保存…` |
| sw | `Ondoa kabisa nyenzo hii iliyoombwa na uarifu timu yetu:` | `Funga ujumbe wa mafanikio` | `Hariri maelekezo na chanzo` | `Hariri maelezo ya ombi` | `Ombi la kuleta` | `Maelezo ya ombi` | `Hifadhi mabadiliko` | `Inahifadhi…` |
| ru | `Навсегда удалить этот ресурс из запроса и уведомить нашу команду:` | `Закрыть сообщение об успешной отправке` | `Изменить инструкции и источник` | `Изменить примечание к запросу` | `Запрос на импорт` | `Примечание к запросу` | `Сохранить изменения` | `Сохранение…` |
| he | `להסיר לצמיתות את המשאב המבוקש הזה ולהודיע לצוות שלנו:` | `סגירת הודעת ההצלחה` | `עריכת ההנחיות והמקור` | `עריכת ההערה לבקשה` | `בקשת ייבוא` | `הערה לבקשה` | `שמירת השינויים` | `שומר…` |
| ar | `إزالة هذا المورد المطلوب نهائيًا وإخطار فريقنا:` | `إغلاق رسالة النجاح` | `تحرير التعليمات والمصدر` | `تحرير ملاحظة الطلب` | `طلب استيراد` | `ملاحظة الطلب` | `حفظ التغييرات` | `جارٍ الحفظ…` |
| pt | `Remover permanentemente este recurso solicitado e notificar nossa equipe:` | `Fechar mensagem de sucesso` | `Editar instruções e fonte` | `Editar observação da solicitação` | `Solicitação de importação` | `Observação da solicitação` | `Salvar alterações` | `Salvando…` |
| id | `Hapus permanen sumber daya yang telah diminta ini dan beri tahu tim kami:` | `Tutup pesan keberhasilan` | `Edit instruksi dan sumber` | `Edit catatan permintaan` | `Permintaan impor` | `Catatan permintaan` | `Simpan perubahan` | `Menyimpan…` |
| ms | `Buang sumber yang diminta ini secara kekal dan maklumkan pasukan kami:` | `Tutup mesej kejayaan` | `Edit arahan dan sumber` | `Edit nota permintaan` | `Permintaan import` | `Nota permintaan` | `Simpan perubahan` | `Sedang menyimpan…` |
| bn | `অনুরোধ করা এই রিসোর্সটি স্থায়ীভাবে সরিয়ে আমাদের দলকে জানাবেন:` | `সাফল্যের বার্তা বন্ধ করুন` | `নির্দেশনা ও উৎস সম্পাদনা করুন` | `অনুরোধের নোট সম্পাদনা করুন` | `ইম্পোর্টের অনুরোধ` | `অনুরোধের নোট` | `পরিবর্তন সেভ করুন` | `সেভ হচ্ছে…` |
| as | `অনুৰোধ কৰা এই সম্পদ স্থায়ীভাৱে আঁতৰাই আমাৰ দলক জনাব:` | `সফলতাৰ বাৰ্তা বন্ধ কৰক` | `নিৰ্দেশনা আৰু উৎস সম্পাদনা কৰক` | `অনুৰোধৰ টোকা সম্পাদনা কৰক` | `আমদানিৰ অনুৰোধ` | `অনুৰোধৰ টোকা` | `পৰিৱৰ্তন সংৰক্ষণ কৰক` | `সংৰক্ষণ হৈ আছে…` |
| hi | `इस अनुरोधित संसाधन को स्थायी रूप से हटाकर हमारी टीम को सूचित किया जाए:` | `सफलता संदेश बंद करें` | `निर्देश और स्रोत संपादित करें` | `अनुरोध का नोट संपादित करें` | `आयात अनुरोध` | `अनुरोध नोट` | `परिवर्तन सेव करें` | `सेव हो रहा है…` |
| vi | `Xóa vĩnh viễn tài nguyên đã yêu cầu này và thông báo cho đội ngũ của chúng tôi:` | `Đóng thông báo thành công` | `Chỉnh sửa hướng dẫn và nguồn` | `Chỉnh sửa ghi chú yêu cầu` | `Yêu cầu nhập` | `Ghi chú yêu cầu` | `Lưu thay đổi` | `Đang lưu…` |
| ha | `Cire wannan albarkatun da aka nema na dindindin kuma sanar da ƙungiyarmu:` | `Rufe saƙon nasara` | `Gyara umarni da tushe` | `Gyara bayanin buƙata` | `Buƙatar shigo da bayanai` | `Bayanin buƙata` | `Ajiye canje-canje` | `Ana ajiyewa…` |
| am | `የተጠየቀውን ይህን ግብዓት በቋሚነት አስወግደው ለቡድናችን ያሳውቁ፦` | `የስኬት መልዕክቱን ዝጋ` | `መመሪያዎችን እና ምንጩን አርትዕ` | `የጥያቄውን ማስታወሻ አርትዕ` | `የማስመጣት ጥያቄ` | `የጥያቄ ማስታወሻ` | `ለውጦችን አስቀምጥ` | `በማስቀመጥ ላይ…` |
| or | `ଅନୁରୋଧ କରାଯାଇଥିବା ଏହି ସମ୍ପଦକୁ ସ୍ଥାୟୀ ଭାବରେ ହଟାଇ ଆମ ଦଳକୁ ଜଣାନ୍ତୁ:` | `ସଫଳତା ବାର୍ତ୍ତା ବନ୍ଦ କରନ୍ତୁ` | `ନିର୍ଦ୍ଦେଶ ଓ ଉତ୍ସ ସମ୍ପାଦନା କରନ୍ତୁ` | `ଅନୁରୋଧ ଟିପ୍ପଣୀ ସମ୍ପାଦନା କରନ୍ତୁ` | `ଆମଦାନି ଅନୁରୋଧ` | `ଅନୁରୋଧ ଟିପ୍ପଣୀ` | `ପରିବର୍ତ୍ତନ ସଞ୍ଚୟ କରନ୍ତୁ` | `ସଞ୍ଚୟ ହେଉଛି…` |

## Validation

- ✅ Re-ran the production read-only scope query: **1,859** active `needs_review = 'ai'` rows across
  the six assigned sections, matching the section sum above.
- ✅ Compared `{placeholder}` token multisets between English and all 1,859 current AI values:
  **zero mismatches**. This covers `text.detected` (`{count}`, `{paragraphs}`) and
  `text.sentence_count` (`{count}`).
- ✅ Confirmed the only absent rows in this section are the stated eight `import_page` keys for all
  18 `TRANSLATABLE_LOCALES`: **144 missing rows**.
- ✅ Counted the draft matrix mechanically: **18 locale rows × 8 values = 144 drafts**; each row has
  exactly eight translation cells. None of the eight English strings has a placeholder, so draft
  placeholder parity is vacuously satisfied.
- ✅ Every current row was assessed against its key-level call-site context. Outcome: **74
  high-confidence row corrections**, **18 context-dependent terminology rows** clearly separated for
  specialist confirmation, and **1,767 rows with no substantive correction recommended**. In
  particular, no high-confidence changes were found in the `sentence` section.
- ✅ During the audit phase, no existing production value was modified; the authorized 144 new
  drafts were staged separately. After approval, all 74 high-confidence proposals in this report
  were applied. The 18 context-dependent rows remain unchanged for specialist review.
