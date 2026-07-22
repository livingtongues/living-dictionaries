# AI i18n audit — public-site sections

Production `shared.db` read-only snapshot pulled 2026-07-22 08:06 UTC; final active-only drift-check snapshot copied 2026-07-22 08:14:17–08:14:43 UTC. No database or locale-file writes were made.

## Scope and method

- Reviewed every **active** production `i18n_translations` row with `needs_review = 'ai'` in the assigned public-site namespaces (`JOIN i18n_keys k ... WHERE k.removed_at IS NULL`): **1,903 rows**, covering **231 distinct keys** and all 18 translatable locales where rows exist.
- Reviewed by English key and UI context, with all locales beside one another. Every key's direct or dynamic call site was checked. Active keys with no call site were evaluated from the English catalog and their feature/roadmap grouping.
- Checked semantic meaning, UI action/object, platform terminology, numbers, product roles, and `{placeholder}` fidelity. All four interpolated key families in scope preserve their placeholders.
- Recommendations below are limited to substantive errors. Natural regional variation, stylistic preference, capitalization, and acceptable transliteration were not treated as defects.

## Coverage

| Section | AI rows reviewed | Distinct keys | Locales represented |
|---|---:|---:|---:|
| `about` | 182 | 48 | 18 |
| `account` | 149 | 12 | 18 |
| `banner` | 4 | 2 | 2 |
| `contact` | 44 | 17 | 18 |
| `create` | 58 | 37 | 2 |
| `dict_home` | 540 | 30 | 18 |
| `dictionary` | 48 | 14 | 18 |
| `footer` | 6 | 3 | 2 |
| `header` | 84 | 14 | 18 |
| `home` | 6 | 6 | 1 |
| `home_v2` | 738 | 41 | 18 |
| `map` | 18 | 1 | 18 |
| `partnership` | 6 | 3 | 2 |
| `terms` | 20 | 3 | 18 |
| **Total** | **1,903** | **231** | **18** |

### Final production drift check

The corrected 08:14 UTC query joins `i18n_keys` and applies `k.removed_at IS NULL`. Its active assigned-prefix set matches the original aggregation: 1,903 rows / 231 keys, including 6 rows / 6 keys under `home`. `home.main_banner` / Assamese is excluded because the English catalog key was soft-removed on 2026-07-07 (`removed_at = '2026-07-07T06:20:49.367Z'`). It had been inadvertently included in the first totals by querying translations without the active-key filter; it is not part of this report's active-row coverage or impact calculations.

## Recommended corrections for active AI rows

### English source changes not reflected in the AI rows

These are not matters of translation taste: the translations still express earlier English source text. Production timestamps corroborate both cases (`en_updated_at` is later than the translation timestamp), and git history shows the exact English changes.

| Key | English now | UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|---|
| `about.import_data` | Import data from any format | Current-features card on the About page (`AboutContent.svelte`, dynamic `about.${feature.key}`) | `de` | Daten importieren (CSV-, JSON-Format) | Daten aus beliebigen Formaten importieren | The current text restricts import to CSV/JSON; the feature now accepts any format. |
| `home_v2.feature_collaboration_body` | Invite managers and contributors. Work together from anywhere, with every change tracked. | Collaboration feature card on the homepage (`FeaturesGrid.svelte`, dynamic feature key) | `am` | አስተዳዳሪዎችን፣ አርታዒዎችን እና አስተዋፅዖ አድራጊዎችን ይጋብዙ። ከየትኛውም ቦታ ሆነው በጋራ ይሥሩ፣ እያንዳንዱ ለውጥ ይመዘገባል። | አስተዳዳሪዎችን እና አስተዋፅዖ አድራጊዎችን ይጋብዙ። ከየትኛውም ቦታ ሆነው በጋራ ይሥሩ፣ እያንዳንዱ ለውጥ ይመዘገባል። | Still advertises an editor role; the product has only manager and contributor dictionary roles. |
| `home_v2.feature_collaboration_body` | same | same | `ar` | ادعُ المديرين والمحررين والمساهمين. اعملوا معاً من أي مكان، مع تتبُّع كل تغيير. | ادعُ المديرين والمساهمين. اعملوا معاً من أي مكان، مع تتبُّع كل تغيير. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `as` | মেনেজাৰ, সম্পাদক আৰু অৱদানকাৰীসকলক আমন্ত্ৰণ জনাওক। যিকোনো ঠাইৰ পৰা একেলগে কাম কৰক, প্ৰতিটো পৰিৱৰ্তন লিপিবদ্ধ হয়। | মেনেজাৰ আৰু অৱদানকাৰীসকলক আমন্ত্ৰণ জনাওক। যিকোনো ঠাইৰ পৰা একেলগে কাম কৰক, প্ৰতিটো পৰিৱৰ্তন লিপিবদ্ধ হয়। | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `bn` | ম্যানেজার, সম্পাদক ও অবদানকারীদের আমন্ত্রণ জানান। যেকোনো জায়গা থেকে একসাথে কাজ করুন, প্রতিটি পরিবর্তন নথিভুক্ত হয়। | ম্যানেজার ও অবদানকারীদের আমন্ত্রণ জানান। যেকোনো জায়গা থেকে একসাথে কাজ করুন, প্রতিটি পরিবর্তন নথিভুক্ত হয়। | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `de` | Laden Sie verwaltende, bearbeitende und mitwirkende Personen ein. Arbeiten Sie von überall zusammen, wobei jede Änderung nachverfolgt wird. | Laden Sie verwaltende und mitwirkende Personen ein. Arbeiten Sie von überall zusammen, wobei jede Änderung nachverfolgt wird. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `es` | Invita a administradores, editores y colaboradores. Trabajen juntos desde cualquier lugar, con cada cambio registrado. | Invita a gestores y colaboradores. Trabajen juntos desde cualquier lugar, con cada cambio registrado. | Removes the nonexistent editor role; `gestores` matches the manager terminology used elsewhere in the same new API copy. |
| `home_v2.feature_collaboration_body` | same | same | `fr` | Invitez des gestionnaires, des éditeurs et des contributeurs. Travaillez ensemble depuis n'importe où, chaque modification étant enregistrée. | Invitez des gestionnaires et des contributeurs. Travaillez ensemble depuis n'importe où, chaque modification étant enregistrée. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `ha` | Ka gayyaci manaja, editoci, da masu ba da gudummawa. Ku yi aiki tare daga ko'ina, ana kuma bin diddigin kowane sauyi. | Ka gayyaci manajoji da masu ba da gudummawa. Ku yi aiki tare daga ko'ina, ana kuma bin diddigin kowane sauyi. | Removes the nonexistent editor role and retains plural “managers.” |
| `home_v2.feature_collaboration_body` | same | same | `he` | הזמינו מנהלים, עורכים ותורמים. עבדו יחד מכל מקום, כשכל שינוי מתועד. | הזמינו מנהלים ותורמים. עבדו יחד מכל מקום, כשכל שינוי מתועד. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `hi` | प्रबंधकों, संपादकों और योगदानकर्ताओं को आमंत्रित करें। कहीं से भी मिलकर काम करें, हर बदलाव दर्ज होता है। | प्रबंधकों और योगदानकर्ताओं को आमंत्रित करें। कहीं से भी मिलकर काम करें, हर बदलाव दर्ज होता है। | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `id` | Undang pengelola, editor, dan kontributor. Bekerjalah bersama dari mana saja, dengan setiap perubahan terekam. | Undang pengelola dan kontributor. Bekerjalah bersama dari mana saja, dengan setiap perubahan terekam. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `ms` | Jemput pengurus, penyunting, dan penyumbang. Bekerja bersama dari mana-mana, dengan setiap perubahan direkodkan. | Jemput pengurus dan penyumbang. Bekerja bersama dari mana-mana, dengan setiap perubahan direkodkan. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `or` | ପରିଚାଳକ, ସମ୍ପାଦକ ଏବଂ ଅବଦାନକାରୀଙ୍କୁ ନିମନ୍ତ୍ରଣ କରନ୍ତୁ। ଯେକୌଣସି ସ୍ଥାନରୁ ଏକାଠି କାମ କରନ୍ତୁ, ପ୍ରତ୍ୟେକ ପରିବର୍ତ୍ତନ ଟ୍ରାକ୍ ହୁଏ। | ପରିଚାଳକ ଏବଂ ଅବଦାନକାରୀଙ୍କୁ ନିମନ୍ତ୍ରଣ କରନ୍ତୁ। ଯେକୌଣସି ସ୍ଥାନରୁ ଏକାଠି କାମ କରନ୍ତୁ, ପ୍ରତ୍ୟେକ ପରିବର୍ତ୍ତନ ଟ୍ରାକ୍ ହୁଏ। | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `pt` | Convide gestores, editores e colaboradores. Trabalhem juntos de qualquer lugar, com cada alteração registada. | Convide gestores e colaboradores. Trabalhem juntos de qualquer lugar, com cada alteração registada. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `ru` | Приглашайте руководителей, редакторов и участников. Работайте вместе откуда угодно, и каждое изменение фиксируется. | Приглашайте руководителей и участников. Работайте вместе откуда угодно, и каждое изменение фиксируется. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `sw` | Alika wasimamizi, wahariri, na wachangiaji. Fanyeni kazi pamoja kutoka mahali popote, huku kila mabadiliko yakifuatiliwa. | Alika wasimamizi na wachangiaji. Fanyeni kazi pamoja kutoka mahali popote, huku kila mabadiliko yakifuatiliwa. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `vi` | Mời người quản lý, biên tập viên và người đóng góp. Cùng làm việc từ bất cứ đâu, với mọi thay đổi được ghi lại. | Mời người quản lý và người đóng góp. Cùng làm việc từ bất cứ đâu, với mọi thay đổi được ghi lại. | Removes the nonexistent editor role. |
| `home_v2.feature_collaboration_body` | same | same | `zh` | 邀请管理员、编辑和贡献者。随时随地协同工作，每一处改动都有记录。 | 邀请管理员和贡献者。随时随地协同工作，每一处改动都有记录。 | Removes the nonexistent editor role. |

### Independent translation errors

| Key | English | UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|---|
| `home_v2.api_subline` | Our API lets AI agents digitize legacy materials and lets apps build on your dictionary. | Explanatory line above the homepage API/agent flow diagram | `ha` | API ɗinmu na ba wakilan AI damar mai da tsofaffin kayan zuwa na dijital kuma yana ba ƙa'idodi damar ginawa a kan ƙamus ɗinka. | API ɗinmu na ba wakilan AI damar mai da tsofaffin kayan zuwa na dijital, kuma yana ba da damar gina manhajoji a kan ƙamus ɗinka. | `ƙa'idodi` means rules/principles, not software applications. `manhajoji` is already used correctly for apps in `about.api_body_2`. |
| `home_v2.api_output_apps` | Language learning apps | Output node in the homepage API/agent flow diagram | `ha` | Ƙa'idodin koyon harshe | Manhajojin koyon harshe | Current text says “language-learning rules/principles,” not apps. |
| `home_v2.map_cluster_tooltip` | `{count} dictionaries — click to zoom` | Tooltip for a clustered group of dictionaries on the homepage map | `ha` | Ƙamus `{count}` — danna don girmama | Ƙamus `{count}` — danna don zuƙowa | `girmama` means “respect/honor” ([linguistic usage](https://www.researchgate.net/publication/349765369_Gesturing_the_unspoken_Conceptualization_of_social_hierarchy_in_Hausa)); it does not mean zoom. `zuƙowa` is listed for “zoom in” in a [Hausa–English dictionary](https://admin.opentran.net/pdf/upload/ha-en.pdf). Placeholder remains intact. |

## Additional stale-source corrections (`en_changed`, not AI audit rows)

The same active `about.import_data` key has 17 non-German translations flagged `needs_review = 'en_changed'`. These rows are **not included** in the 1,903 active-AI-row audit denominator or the 22 AI corrections above. They all still restrict the feature to CSV/JSON even though the About-page feature card now promises imports from any format.

| Key | English now | UI context | Locale | Current | Proposed | Reason |
|---|---|---|---|---|---|---|
| `about.import_data` | Import data from any format | Current-features card on the About page (`AboutContent.svelte`, dynamic `about.${feature.key}`) | `am` | ውሂብ ከውጭ አስመጣ (የ CSV, JSON ቅርጸቶች) | ከማንኛውም ቅርጸት ውሂብ ያስመጡ | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `ar` | استيراد البيانات بصيغ CSV وJSON | استيراد البيانات من أي صيغة | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `as` | তথ্য় আমদানি কৰক (CSV, JSON ফৰ্মেটবোৰত) | যিকোনো ফৰ্মেটৰ পৰা তথ্য আমদানি কৰক | Replaces the obsolete CSV/JSON restriction and corrects the malformed spelling of “data.” |
| `about.import_data` | same | same | `bn` | ইম্পোর্ট ডেটা (সিএসভি, জেএসএন ফর্ম্যাট) | যেকোনো ফরম্যাট থেকে ডেটা আমদানি করুন | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `es` | Importar datos (en formatos CSV, JSON) | Importar datos desde cualquier formato | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `fr` | Importation de données (formats CSV, JSON) | Importer des données depuis n'importe quel format | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `ha` | Import Data (CSV, JSON tsaren) | Shigo da bayanai daga kowane tsari | Replaces the obsolete formats and untranslated English label with Hausa “import data from any format.” |
| `about.import_data` | same | same | `he` | ייבוא נתונים (פורמטים: CSV, JSON) | ייבוא נתונים מכל פורמט | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `hi` | प्रविष्टियों को आयात करें ( CSV, JSON के रुप में) | किसी भी प्रारूप से डेटा आयात करें | Current text says “import entries” and limits formats; proposed text accurately says data from any format. |
| `about.import_data` | same | same | `id` | Mengimpor Data (CSV, format JSON) | Impor data dari format apa pun | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `ms` | Import Data (format CSV, JSON) | Import data daripada sebarang format | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `or` | ଡାଟା ଆମଦାନି (CSV, JSON ଶୈଳୀରେ) | ଯେକୌଣସି ଫର୍ମାଟ୍‌ରୁ ଡାଟା ଆମଦାନୀ କରନ୍ତୁ | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `pt` | Importar Dados (formatos CSV, JSON ) | Importar dados de qualquer formato | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `ru` | Импорт данных (в форматах CSV, JSON) | Импорт данных в любом формате | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `sw` | Safirisha data kutoka mfumo wa (CSV, JSON) | Ingiza data kutoka umbizo lolote | Current text says “export data” and limits formats; proposed text accurately says import data from any format. |
| `about.import_data` | same | same | `vi` | Nhập dữ liệu (định dạng CSV, JSON) | Nhập dữ liệu từ bất kỳ định dạng nào | Replaces the obsolete CSV/JSON restriction with “any format.” |
| `about.import_data` | same | same | `zh` | 导入数据（CSV，JSON格式） | 从任意格式导入数据 | Replaces the obsolete CSV/JSON restriction with “any format.” |

## Borderline cases intentionally left unchanged

- `dictionary.full_title` in German retains “Living Dictionary” in a generated citation. Because this is an official product label and the German interface also retains “Living Dictionaries” elsewhere, translating it would be a branding/style choice rather than a clear correction.
- Hausa cover-photo strings use wording closer to “background image.” The image is rendered as the dictionary hero background, so this does not mislead the action enough to warrant a correction.
- Several languages translate “featured” with words that can also mean selected/favorite. The public featured strip, star icon, and add/remove actions supply the intended meaning; no locale clearly reverses or loses the function.

## Impact summary

- Requested AI audit: **22 suggested row corrections** out of **1,903 active AI rows reviewed** (1.16%).
  - **19** are stale AI translations of changed English strings: German `about.import_data` plus the collaboration-role sentence in all 18 locales.
  - **3** are concrete Hausa lexical errors in visible homepage API/map copy.
  - The other **1,881 active AI rows** have no substantive correction recommended.
- Additional adjacent stale-source review: **17 active `en_changed` corrections**, comprising every non-German locale for `about.import_data`.
- **39 total row corrections proposed** if the AI and `en_changed` suggestions are approved together.
- ✅ All 39 were approved and applied in the guarded 2026-07-22 correction transaction.
