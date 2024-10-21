# Migrate Entries and Speakers from Firestore to Supabase
- pnpm -F scripts test:migration

## PREP TODO
- search for ExpandedEntry
- run tests and get PR passing
- continue running data in batches from 148K+
- Use `pnpm mixed` to run Firebase prod and Supabase local and preview everything
- Using mixed look through local orthographies - especially in the table view
- Orama: async load down saved index from Vercel KV
- visual inspection of the results locally - should work similar to current prod

## Migration Process
- post notice on logged-in users a week ahead of time
- send email notice a week ahead of time
- Sort entries from oldest created to newest created so that first person to add a dialect gets the created_by credit
- Make sure all items from "clean-up" below are being actively logged again as they are run into
- Lock down Firestore dictionary words and speakers using security rules (tell admins not to edit anything)
- Migrate data
  - ensure all auth users are brought over
  - add placeholder entries for all current senses in live db
  - Make Supabase backup (manually trigger) and place as seed
  - ensure there are placeholder entries for all current senses in prod db before pushing migration
  - push sql migrations to prod db (making sure the 3 entries dropped columns are uncommented)
  - run `pnpm -F scripts save-firestore-data` to download Firestore speakers, entries, and users data locally
  - run migration script
- Test viewing
- Merge new saving methods code (this will be a natural unblock) and hide Algolia search results
- Test editing entries
- Remove notice
- Email letting everyone know editing is available again

## Clean-up
- dictionary counts
- get semantic domains working in filters ( currently just filters out entries without a semantic domain)
- Remove algolia keys from vercel
- Orama: replaceState in createQueryParamStore? look into improving the history to change for view and page changes but not for the others
- create indexes using help from index_advisor https://supabase.com/docs/guides/database/extensions/index_advisor
- drop content_updates' table column
- drop entry_updates
- clean up old history data in content_updates
- make alternate writing systems of the sentence translations as different bcp keys (same as for glosses)
- look at print, table, gallery, and list page files history to make sure there are no missed improvements - check github history too
- see how seo_description made the transition

### No lexeme
no lx for 0svukh699MsB4svuCDdO in ho
no lx for Lk5BvTzII89NQM1vo5hm in ho
no lx for RHCsFR9Zy9sln7EeZNNK in ho
no lx for Oc7OXnShvaYa27zRHuWH in quechua-chanka
no lx for 1WV2oFfqz1lPTEq4EvoJ in siletz-dee-ni
no lx for g4BAfdCkx9fg1xaPTMwf in siletz-dee-ni
no lx for kNBJriGyBmOKA3wujOVo in siletz-dee-ni
no lx for lCqvetMVNvq4WMLrReKT in siletz-dee-ni
no lx for rNvXCBBW7NvIqzgdqof0 in siletz-dee-ni

### 4 garifuna entries have a local_orthography_1 that is more of a gloss

local_orthography_1: Él no tuvo sexo conmigo. in garifuna Ao0N0xEanD0wSwyZ2uh4
local_orthography_1: El techo está goteando. in garifuna FLBNBl4HYdiP3mgvY2Ug
local_orthography_1: The whale swallowed Jonah. in garifuna VWRTqDWAUQszvbkMgL2f
local_orthography_1: Este tren corre de prisa. in garifuna f79wFG4QUeWnUoPl2n5w

### xv and xs.vn (kept xs.vn)
both xv I regularly took her coffee and a crusty roll with cheese and pickle, which she loved. and xs.vn She likes pickle for QYg0WXOYJCXXY373QVUC in malapulaya
both xv Pay papata allashan. and xs.vn Pay papata allashan. for 2UrLJneJyNfP4YXil7u5 in quechuaboliviano
both xv khuruta wanchirqani. ( maté un gusano) and xs.vn Runa masiykita khuyay. for 9t7tdgRQRgtm4xQYOH4r in quechuaboliviano

### xs.vernacular or xs.xv overwritten by xs.vn

xs.vernacular or xs.xv "twiina vaana vadatu" overwritten by xs.vn "twina (tu+ina) vaana vadatu" for 5UGEw8TGP4t0Isne8g1b in kihehe
xs.vernacular or xs.xv "uyu akwipyeega nimyenda imipya" overwritten by xs.vn "Neeng'ino vakwipyeega hiilo." for US50CL5NfjiihIbebvFg in kihehe
xs.vernacular or xs.xv "inyama yina kigolya" overwritten by xs.vn "ikigolya kikaangafu" for XmuYRMRcU3b4vjzdFhbX in kihehe
xs.vernacular or xs.xv "wihosa kiki?" overwritten by xs.vn "wiihoosa kiki?" for f38jpgW06ChUKUvvxYsR in kihehe
xs.vernacular or xs.xv "ululenga lukepwike" overwritten by xs.vn "ululeenga lukeepite" for fv8krOKhtGg34zuYi0kE in kihehe
xs.vernacular or xs.xv "umung'inetu igondola amafuta" overwritten by xs.vn "dondola amafuta" for v2VmcovD17QUmBdBj0Ev in kihehe

xs.vernacular or xs.xv "aruḍ n-imezyanen" overwritten by xs.vn "aruḍ n-imezyanen" for dDMmxORT3Q0sjBvUFEe1 in tacawit

xs.vernacular or xs.xv "chòò a bàm mə̀ wàyn" overwritten by xs.vn "chòò a bàm ə̀ wàyn" for CBAIL9dnpuibhJ68P3m3 in babanki

xs.vernacular or xs.xv "Amblgha nu namblgha teken." overwritten by xs.vn "Il Ambelga kelgh il" for Cti1nNlw3DXNotnvVUic in temboka

### Different speaker ids

OcjvabblZrcwOWT9kTCW in ishir-chamacoco has speaker D5Gp9pH4yOuCLips5kQB in sf and CX9f4QKp5FDATE17GNpm sfs

Ixj4lZJPXv8UBSNejzPP in siculo-arberesh has speaker Eaq21bLEjxVM6Db0PzRw in sf and OLo8fRLsgNgGrlZEy7FM sfs

3mNrkcfVcTq2D7qoWnb1 in iipay-aa has speaker Ter4NIjPbVE0t0NyAoVR in sf and OHlCRcVbVX4IyK5Nm1YM sfs
OUd8qB9F9vbkdKQb4crZ in iipay-aa has speaker Ter4NIjPbVE0t0NyAoVR in sf and OHlCRcVbVX4IyK5Nm1YM sfs
V9LH0CuwngGubGWxZY5k in iipay-aa has speaker Ter4NIjPbVE0t0NyAoVR in sf and OHlCRcVbVX4IyK5Nm1YM sfs
g9BOz1gS14TgBfuBUeAE in iipay-aa has speaker Ter4NIjPbVE0t0NyAoVR in sf and RfcNuRw3Zoa44jk0eUgy sfs
kUPCcmZsidSJxQDVINOi in iipay-aa has speaker Ter4NIjPbVE0t0NyAoVR in sf and OHlCRcVbVX4IyK5Nm1YM sfs

6TAQVjmhlNzuyknysKwJ in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
DI9fNDwGkTqQTCCAVN2V in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
Fc95nVZfeXKmRDy6OiFO in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
GzhIOax4MoDyV8dWAwyH in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
MNogRfA6nybGtfBTzebW in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
NjVUmkjw4kjApEOa3gat in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
OMGxE3LXoO6RJ4nMtdaP in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
PCUxoa7bYvU6aTeLVKaw in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
QBNp8eZf7d9JCTHjS36I in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
ScH8gcPrUjsP5hvND2tb in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
cNAjcrhax9hsHBobhHzZ in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
hbxdPqbVRkyztmEOzHe8 in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
hxVQaY3XNyAZjedhQ8jv in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
pTd8WDjW5qSnFHQd8pMV in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs
sj65w0e0S86iY9TK8auQ in kalmyk has speaker Lur4JgdzVlvJHNkIokQn in sf and JcNuxm033COULRzLwkRw sfs

Ip0kEAlLWgL268cAnUo9 in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
AAuFBDAEN4ziOIIGzrg2 in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
KV4Awv9NJ4Us4w4brtxu in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
MhreZz0NQe8p5nmv5aOt in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
NY48uxISRlJXdJcnOsuU in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
NiNNOh0w1gg87OP6CbQ0 in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
RwOgDYi1HfzXxToreQqI in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
V7Yd159L4K4aaku9mnKs in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
Zb0Ff7exOC8kxwb6dlZp in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
gZFTm1qnc1xSANcROhoo in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
q4VagShEMZqhJj7EKLGS in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
tziPBlaykrYOryMjaicM in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
vLNwhXMtDwHfJVvEcjo0 in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs
yHXwW4LAOW11K1miBdN9 in kalmyk has speaker vtm0hI5JpMtGtpVih28T in sf and JcNuxm033COULRzLwkRw sfs

### lo and lo1

lost lo: फुड़ु: रोः एम in favor of lo1: फुड़ु: रोःएम for 0BipRZhVn5CjHq5UwjLB in birhor
lost lo: बोहोः ते कुइडुः काय in favor of lo1: बोहोःते कुइडुः काय for 0Ks3qbYaqNlmoPW7DROl in birhor
lost lo: इङ अर हेरेल तिङ रि हुडिङ बारे तेः in favor of lo1: इङ अर हेरेल तिङरि हुडिङ बारेतेः for 0LOSXZ5dkM76bYrFHIT2 in birhor
lost lo: एटाः होड़ के सुनुम ओजोः केते मालिसयेमि in favor of lo1: एटाः होड़के सुनुम ओजोःकेते मालिसयेमि for 0REk8eAb3FNbpKVnGn8A in birhor
lost lo: माड़ाङ दाइ रि जांवांइ ते in favor of lo1: माड़ाङ दाइरि जांवांइते for 0RzoKeLuqZhpfNpkEHcw in birhor
lost lo: हिजुः रा: दिन in favor of lo1: हिजुःरा: दिन for 0SpouO6c5VXFt3rbWSGY in birhor
lost lo: कोड़ि ते पुइमे in favor of lo1: कोड़िते पुइमे for 0iUxOblcGXDcORZb3BH8 in birhor
lost lo: डुबा कनाये होड़ ता in favor of lo1: डुबा कनाये होड़ता for 0l7ZbJqqEYeu7EAZz0bL in birhor
lost lo: हुड़ु ना: हेड़े in favor of lo1: हुड़ुना: हेड़े for 0udbHHoTGOwlgZdEMQeG in birhor
lost lo: हाकु साप राः ठेङगा in favor of lo1: हाकु सापराः ठेङगा for 10lBYE1wCoIvcmGppY0h in birhor
lost lo: जानवर राः चाहुअट in favor of lo1: जानवरराः चाहुअट for 13qytCkD0vNJyDUyBFDZ in birhor
lost lo: तोवा राः मखन in favor of lo1: तोवाराः मखन for 198JPQD27oEsC01G17jQ in birhor
lost lo: तांड़ि उडोङो: मि in favor of lo1: तांड़ि उडोङो:मि for 1ATI8ZshebW4YGbWKP7r in birhor
lost lo: झुला गानजि होरो: एम in favor of lo1: झुला गानजि होरो:एम for 1OlzMfZ31WB7vg84xbCI in birhor
lost lo: ओमोन नाः in favor of lo1: ओमोननाः for 1WHapX0E84z6m3mif0wa in birhor
lost lo: राड़ेच ना in favor of lo1: राड़ेचना for 1WmXxxWa4C9kCQoKsa8H in birhor
lost lo: ढापनि ता ओचोः एम in favor of lo1: ढापनिता ओचोःएम for 1pqAdAzWHH3Z7JbLGpPx in birhor
lost lo: इङ गि in favor of lo1: इङगि for 1qMexCeDZknjWINYywkj in birhor
lost lo: कुलि कु in favor of lo1: कुलिकु for 1r3AgZP8jB7L2tXa888S in birhor
lost lo: ओकोए लोःते in favor of lo1: ओकोएलोःते for 1sHxzXKHczYSWYSx4Qo7 in birhor
lost lo: दाः रे दोहोयमि in favor of lo1: दाःरे दोहोयमि for 1vyqLIeJCwv8hXkHxrbB in birhor
lost lo: रुअड़ वाइमि in favor of lo1: रुअड़वाइमि for 2Ds60R4xamBUlNQEvHjm in birhor
lost lo: बोङगा एरि कुम in favor of lo1: बोङगा एरिकुम for 2Foz9xOOBVquyxbh2RYH in birhor
lost lo: बपला खातिर हुनी के मेताइयिम in favor of lo1: बपला खातिर हुनीके मेताइयिम for 2XiAzLA9XkQz0oUd5Wsj in birhor
lost lo: सेटेर नाए in favor of lo1: सेटेरनाए for 2tX6Mb3a0nBLdmHzFQqZ in birhor
lost lo: नाति तिङ रि बहु ते: in favor of lo1: नाति तिङरि बहुते: for 3AbrgfJMgAgRaXZ43KV2 in birhor
lost lo: दाः रे पएरामे in favor of lo1: दाःरे पएरामे for 3L2yqFbR6D413VtHvjG4 in birhor
lost lo: कांसा रा: चाटु in favor of lo1: कांसारा: चाटु for 3V9fWIf2d3OJe3HyIiTd in birhor
lost lo: अजारिअपुतेः in favor of lo1: अजारि अपुतेः for 3j6W0D9bDZYbt2TBIDLd in birhor
lost lo: बारेत तेः in favor of lo1: बारेततेः for 3oI7MKmxMiDTtLxMygZ9 in birhor
lost lo: उयु नाय in favor of lo1: उयुनाय for 3vRwRuur8nYfUS4BlOrh in birhor
lost lo: सेदाये रेना: जिव in favor of lo1: सेदायेरेना: जिव for 3wKJ8AHCPQ0UshiG6nW6 in birhor
lost lo: जाहां लेका ते in favor of lo1: जाहां लेकाते for 3zRQU97mqZaifULM7mbT in birhor
lost lo: गति तिङ हेरेल ते: in favor of lo1: गतितिङ हेरेलते: for 3zbojxU8eMTCiBjPUYxx in birhor
lost lo: सेदाए राः कहानि in favor of lo1: सेदाएराः कहानि for 429xs8bhGmzEcYH5DkAQ in birhor
lost lo: उनि लोः in favor of lo1: उनिलोः for 47Qpwa973ZHxziSutkjX in birhor
lost lo: नवा ते बनावेम in favor of lo1: नवाते बनावेम for 4H0nw5dmwpxTHJTbU1n3 in birhor
lost lo: सकम राः कुमबा in favor of lo1: सकमराः कुमबा for 4K6ndYIWUQn4JOYCwIOq in birhor
lost lo: जाहनाः गे लुतुमेम in favor of lo1: जाहनाःगे लुतुमेम for 4RNxRgORP5hFM6VjHJOH in birhor
lost lo: बोङगा बुरु नाः कासा थारी in favor of lo1: बोङगा बुरुनाः कासा थारी for 4fxQLCC9bvD2xGjzIeO6 in birhor
lost lo: अः रे डोरा तोलेम in favor of lo1: अःरे डोरा तोलेम for 4jPJyVnNsbjXI1KREtfN in birhor
lost lo: बारेत ते: अर दाइ ते: in favor of lo1: बारेतते: अर दाइते: for 4l7PZaE8nEhdbsvhFgV6 in birhor
lost lo: सेकम रा: डंटिच ते: in favor of lo1: सेकमरा: डंटिचते: for 5Ah2D70R7VdTFIPwzc4F in birhor
lost lo: हेंदे जाङ रा: मि: in favor of lo1: हेंदे जाङरा: मि: for 5HhEvSNLn7eSWDyV5VB0 in birhor
lost lo: कारे ते in favor of lo1: कारेते for 5W9GPUC6byKOH8ymePne in birhor
lost lo: चुटि तेः in favor of lo1: चुटितेः for 5a1PzaF9yB9gogLYlXXT in birhor
lost lo: सोतो: जोरो: का in favor of lo1: सोतो: जोरो:का for 5aI1HrTfhSouzFGZk9di in birhor
lost lo: ताहि: मि in favor of lo1: ताहि:मि for 5dixDhOXMoCkKTzuKRuQ in birhor
lost lo: निदा ते in favor of lo1: निदाते for 5tLF9mIwYx1YS8sq5OWg in birhor
lost lo: दादा तिङ in favor of lo1: दादातिङ for 5x6u2KomAdAq2ClDT0vV in birhor
lost lo: दारु रे सेकम सागेनओः कना in favor of lo1: दारुरे सेकम सागेनओः कना for 5xD4C027OYydWwcxwXon in birhor
lost lo: दारु रा: बकला: in favor of lo1: दारुरा: बकला: for 5yZXWeW2yW1KR1v2MITt in birhor
lost lo: इङ तिगि मोचा अबुङ in favor of lo1: इङतिगि मोचा अबुङ for 5yldO2HNFqjWqJh32I2Q in birhor
lost lo: बुगिनगि सोः कना in favor of lo1: बुगिनगि सोःकना for 62hAPqp584Ycm2K7EmhD in birhor
lost lo: अबुङ राः in favor of lo1: अबुङराः for 68f2NpEMOAeVMMpQJ1oR in birhor
lost lo: नुआ हिलोः रे in favor of lo1: नुआ हिलोःरे for 6Ib8KeLf38FEHIt0eNtv in birhor
lost lo: हलाङ एम in favor of lo1: हलाङेम for 6IjbTlhXmWTv7kxxD5eR in birhor
lost lo: बिन बुलुंङ नाः माड़ि in favor of lo1: बिन बुलुंङनाः माड़ि for 6NM75KJhzMmzRDkPOUxf in birhor
lost lo: हटाः ते हुड़ु मि:ते जाड़वाएम in favor of lo1: हटाःते हुड़ु मि:ते जाड़वाएम for 6VYoCT1z2NrYGlknJ81N in birhor
lost lo: बहा राः सोः तेः in favor of lo1: बहाराः सोःतेः for 6W2kfcP3ZYE1wLlj106W in birhor
lost lo: दिया राः बत्ती in favor of lo1: दियाराः बत्ती for 6kXjftcW89KvZkJOkm98 in birhor
lost lo: अगममारङ in favor of lo1: अगम मारङ for 6xdHBGfAc3i6zgEAuOBn in birhor
lost lo: बुसुः राः in favor of lo1: बुसुःराः for 79w2l94U9iDHavfmPSAj in birhor
lost lo: सेता ता गरेद कनाये in favor of lo1: सेताता गरेद कनाये for 7BPRSbmaWfGX0xWawMzk in birhor
lost lo: ओकोए ते in favor of lo1: ओकोएते for 7C0ihyUQE0QFeEWk21CO in birhor
lost lo: चेंड़ें राः ठोर in favor of lo1: चेंड़ेंराः ठोर for 7JhrbHhTKF6kHovQTJRl in birhor
lost lo: अड़गुइरिइदिआये in favor of lo1: अड़गुइरि दिआये for 7ObamcKSwm3MFcqrs0JD in birhor
lost lo: उनि के कुलि कायमि in favor of lo1: उनिके कुलि कायमि for 7UMeEh6o4m7ARw0Wd9PM in birhor
lost lo: डुबाओ ना in favor of lo1: डुबाओना for 7fSmXV6D4w369iEQgG69 in birhor
lost lo: जो राः बगिचा in favor of lo1: जोराः बगिचा for 7fZD2R0IPGyTuvTGMQLq in birhor
lost lo: उप ता तुङु अकना in favor of lo1: उपता तुङु अकना for 7hfwA3lkVFoqqRF2yxzp in birhor
lost lo: बपलाः मि in favor of lo1: बपलाःमि for 7jLLPtpbkcaotpl91rmW in birhor
lost lo: हुड़ु रा: बिंडा in favor of lo1: हुड़ुरा: बिंडा for 7kEAw8R9XoAsV6zLnUyt in birhor
lost lo: जोः एम in favor of lo1: जोःएम for 7kloam1DNZ5bgehIWsUw in birhor
lost lo: लुबुः चाउलि नाः in favor of lo1: लुबुः चाउलिनाः for 7vqIMUAYhL2sQ0y4XtvO in birhor
lost lo: हुचा: एनेच रा: in favor of lo1: हुचा: एनेचरा: for 8guVxUxhQPgsGCJzwwW3 in birhor
lost lo: ताला रे in favor of lo1: तालारे for 8gxAaqMxamxZsmPHKLZ6 in birhor
lost lo: मात उत राः गितिल उत in favor of lo1: मात उतराः गितिल उत for 8uowVmyp9SSQOvQXEk75 in birhor
lost lo: असथिर असथिर ते in favor of lo1: असथिर असथिरते for 9RwgV7FleB0FrtJE0LHs in birhor
lost lo: बेदा गम कम in favor of lo1: बेदा गमकम for 9X8JxyRRjVIzXXaH8p7e in birhor
lost lo: जांहाए राः तयोम in favor of lo1: जांहाएराः तयोम for 9jufPmD0BqRs81ACziVN in birhor
lost lo: सुतम-रा: गेंठ in favor of lo1: सुतमरा: गेंठ for 9ne8MnzAR6e1azl5A74I in birhor
lost lo: खार नाः in favor of lo1: खारनाः for 9xkpu55TL7ID7oZvQ5F5 in birhor
lost lo: भुसड़ि राः झाली in favor of lo1: भुसड़िराः झाली for A2sn6xkRCnsbt9Y0U8rM in birhor
lost lo: सहान नाः हथोड़ि in favor of lo1: सहाननाः हथोड़ि for A5havcNRp6qGeLsrWcgv in birhor
lost lo: तमाखु राः सकम in favor of lo1: तमाखुराः सकम for A6RxjptuROwgJDDeeSVq in birhor
lost lo: जोत इरि में in favor of lo1: जोत इरिमे for A9DTEqbmIcPIfPp0bLeg in birhor
lost lo: चेंड़ें रा: मोचा in favor of lo1: चेंड़ेंरा: मोचा for A9aFzFQgFoOQ2URHNU4U in birhor
lost lo: तयोम ते in favor of lo1: तयोमते for AOG3JeM7aWwfYVc1Vj94 in birhor
lost lo: निमि ते in favor of lo1: निमिते for AmdMJa4WtKPCsyjk3LLO in birhor
lost lo: उनि के परोमाइमि in favor of lo1: उनिके परोमाइमि for AovSbvhpiJ38CHdPFRNP in birhor
lost lo: बिसि राः जाङ in favor of lo1: बिसिराः जाङ for AuxNcQBNxTO2yk2hEpbW in birhor
lost lo: जड़वा कुम in favor of lo1: जड़वाकुम for AvwUZwB0fdNOIIdvQCxd in birhor
lost lo: मात राः खेचाः in favor of lo1: मातराः खेचाः for AykQiQevFocBB3tfxOIA in birhor
lost lo: अनाकारतेएसेत in favor of lo1: हनाकारते एसेत for B9aCMdl1KL4JU5b09cTD in birhor
lost lo: बेरेल नाः जो in favor of lo1: बेरेलनाः जो for BALPmUruOcGqyfRFWCpf in birhor
lost lo: भित रे जेरेलिङ हसा in favor of lo1: भितरे जेरेलिङ हसा for BMaGx2NmEq2Pv8jKZbBs in birhor
lost lo: ओसार-नाः in favor of lo1: ओसारनाः for BOliDp21fCZcBEkd0yGz in birhor
lost lo: चानदु राः मसकल in favor of lo1: चानदुराः मसकल for BPywmU7UokzsRyxekWAb in birhor
lost lo: बार तला राः ओड़ाः in favor of lo1: बार तलाराः ओड़ाः for BZiFRDrTvC8HuCp3Fs9d in birhor
lost lo: सहनाइ राः चुटि ते: in favor of lo1: सहनाइराः चुटिते: for BlqxwoFdoVh0ikvimKMj in birhor
lost lo: इङ ते राबुड़ निङ in favor of lo1: इङते राबुड़निङ for BuDOT6NuEN3akRc8SHaI in birhor
lost lo: गाड़ा लोसोद ते एसेद कना in favor of lo1: गाड़ा लोसोदते एसेद कना for BuLk0Gwk1vsiRjXE7mSS in birhor
lost lo: हुड़िङ बाहिन तेः in favor of lo1: हुड़िङ बाहिनतेः for Bv98NoxVl6kj44aGq6q5 in birhor
lost lo: अगमधेरगे in favor of lo1: अगम धेरगे for C5MrqQQpUozY673ND67w in birhor
lost lo: साड़िय अनाते साड़िमे in favor of lo1: साड़ियअनाते साड़िमे for C8Qq2SGJJ6bTLxzTC0gP in birhor
lost lo: लाहा हजु मि in favor of lo1: लाहा हुजुमि for CUj1OtNslw00x2aAV2RC in birhor
lost lo: मनवे जोम रिः in favor of lo1: मनवे जोमरिः for CbDsqtJZfruT2DFznlN3 in birhor
lost lo: चोचरा तेः in favor of lo1: चोचरातेः for CeEQaANDzvNm9XjU91G0 in birhor
lost lo: तुनडा: रा: लेङगा ति साथ राः हरता तेः in favor of lo1: तुनडा:रा: लेङगा ति साथराः हरतातेः for Cig48ARPvrPgr1KtPiFZ in birhor
lost lo: साल ते उयु नाय in favor of lo1: सालते उयुनाय for Cl3BJmYj7195q7wqFaCO in birhor
lost lo: नाकिचोः मि in favor of lo1: नाकिचोःमि for CwLx5qh9NEHCIcuFLAgi in birhor
lost lo: अम लोः in favor of lo1: अमलोः for CxeqzPdfTx1eseBg8QgN in birhor
lost lo: ओल केम in favor of lo1: ओलकेम for DEySG6fXhFwSrtdgE6g1 in birhor
lost lo: उनि होपोन तके ओमायेमि in favor of lo1: उनि होपोनतके ओमायेमि for DRAS4NkUHUeEuhpSbNX4 in birhor
lost lo: मराङ दाइ तेरि होपोन ते: in favor of lo1: मराङ दाइतेरि होपोनते: for DTRWiS8JXHBuWOhLQs90 in birhor
lost lo: टुटुरि ओटाः एम in favor of lo1: टुटुरि ओटाःएम for DWLpRBWrU4khSk6bs5HO in birhor
lost lo: मुं राः चुनदी तेः in favor of lo1: मुंराः चुनदीतेः for DXfLJXZkbpXzskQupkvH in birhor
lost lo: हपे ते गपममि in favor of lo1: हपेते गपममि for Dhcs7CDQXOij2bj9PLvN in birhor
lost lo: हिनि के बचाओ केयम in favor of lo1: हिनिके बचाओकेयम for DhjrFfcziIwhjYJesWlw in birhor
lost lo: बिरित तेनाए in favor of lo1: बिरिततेनाए for DnKbAJkVmZ3jUkQS2lxP in birhor
lost lo: टाङगा काधि रे गो: एम in favor of lo1: टाङगा काधिरे गो:एम for DpIKYaefHCLQYqs0X6Z3 in birhor
lost lo: मनदिर राः चुटि तेः in favor of lo1: मनदिरराः चुटितेः for DtfLrrz9wINHiKAtVUtY in birhor
lost lo: बाङ रे in favor of lo1: बाङरे for DzK41xMp9PEq7YzjhTwy in birhor
lost lo: सिम बका राः बुलु ते: in favor of lo1: सिम बकाराः बुलुते: for E2T6ZPLip1V0N62gBeVE in birhor
lost lo: पड़ाः एम in favor of lo1: पड़ाःएम for EB0oWhZLQEwqxlULAYek in birhor
lost lo: लासेर नाः in favor of lo1: लासेरनाः for EWeDJGUM0khuVgPicmRI in birhor
lost lo: उमु: रा: ठांय in favor of lo1: उमु:रा: ठांय for ExBkZg36qYi7Aciv6DKx in birhor
lost lo: साबिन ते माराङ दादा in favor of lo1: साबिनते माराङ दादा for F8PWC0NoF6uGHq29txSw in birhor
lost lo: इङ मेन तिगि in favor of lo1: इङ मेनतिगि for FBTkoMWgpYEntq2yIVAW in birhor
lost lo: बहिर नाः in favor of lo1: बहिरनाः for FG7oQuNOkFbGODwKnHVl in birhor
lost lo: एटाः एटाः लेकन नाः in favor of lo1: एटाः एटाः लेकननाः for FIkheWI9PA0aOBt6jFy4 in birhor
lost lo: पाड़हा रा: पाठ in favor of lo1: पाड़हारा: पाठ for Ff2CahaBL6dP4WUJDJvm in birhor
lost lo: उल ता बेरेलगे रपाः कना in favor of lo1: उलता बेरेलगे रपाः कना for FfDoHLQ0J3svwf4Yd0iD in birhor
lost lo: कचुर बगि ताय in favor of lo1: कचुर बगिताय for FwImFESfcnsmXNupKbb4 in birhor
lost lo: सुनुम लोः अतायमि in favor of lo1: सुनुमलोः अतायमि for GB1vYvpEQIjdlC3ZqEQa in birhor
lost lo: मराङ दिदि तेः in favor of lo1: मराङ दिदितेः for GDxJBVbfCFlatIFHB4C0 in birhor
lost lo: उप ते पांड़ु ना in favor of lo1: उपते पांड़ुना for GSHJq3gn7a3Kk3mdr6OE in birhor
lost lo: चुलहा राः मोचा in favor of lo1: चुलहाराः मोचा for Gfb7OqhPkmekxAphkpFN in birhor
lost lo: सुइ रे सुताम परोमेम in favor of lo1: सुइरे सुताम परोमेम for GlE5DzulZSLW2tHD1Hff in birhor
lost lo: अगाममोटा in favor of lo1: अगाम मोटा for GnBlcNzzwICi3JXHhquN in birhor
lost lo: मुं ते गपम रि होड़ in favor of lo1: मुंते गपमरि होड़ for GnoHHsexPzZkwcXTJd6F in birhor
lost lo: सिम राः मोर in favor of lo1: सिमराः मोर for GqjmcfcgkYrcB7ooNDXe in birhor
lost lo: दा: रा: दिन in favor of lo1: दा:रा: दिन for Grrpjl5nNkv65zBrcOYy in birhor
lost lo: अरो सुनुः मि in favor of lo1: अरो सुनुःमि for Gxaoms8i4huR5pSzro8B in birhor
lost lo: मात रा: सुनुम सोङ रा: in favor of lo1: मातरा: सुनुम सोङरा: for H1PQCWQC3jcJbzwXcfaY in birhor
lost lo: हरता राः चापल in favor of lo1: हरताराः चापल for H35EWNtshdkgaIu9gyJJ in birhor
lost lo: बारेत तिङ in favor of lo1: बारेततिङ for H5iS7wb2VTeeqfO80RfJ in birhor
lost lo: बोङगा राः ठांय in favor of lo1: बोङगाराः ठांय for H9hDhFu0aZ1smEOrFleD in birhor
lost lo: मारि नाः in favor of lo1: मारिनाः for HAAfLKBw5oaJrN5WVlld in birhor
lost lo: ठेङा ते रुवेयमि in favor of lo1: ठेङाते रुवेयमि for HEFZQrr3OX2kD9Jrbaac in birhor
lost lo: धेर ना in favor of lo1: धेरना for HHF8hj4RdlUkfy5dmeRK in birhor
lost lo: इङ के रगड़ाः इङ in favor of lo1: इङके रगड़ाःइङ for HVHncl87yuRiknvBf91R in birhor
lost lo: हमबाल नाः ते रुरुङ in favor of lo1: हमबालनाःते रुरुङ for HWbqDjLHZXgtZKAZ52Fh in birhor
lost lo: हेरेल तिनिः मराङ दाई तेः in favor of lo1: हेरेल तिनिः मराङ दाईतेः for HlBCHj5wFWaVpdRhCX80 in birhor
lost lo: मोचा ते: गुलेम in favor of lo1: मोचाते: गुलेम for HlGqCfePrvmZdlfmKkx1 in birhor
lost lo: बलबल ते लोहोत तिनिङ in favor of lo1: बलबलते लोहोत तिनिङ for HmujWlio7uFC7tNVpYGR in birhor
lost lo: उसकाओ केते रुरुङेम in favor of lo1: उसकाओकेते रुरुङेम for HuzxwxtzVO1G7L83xrAH in birhor
lost lo: आत तेना in favor of lo1: आततेना for IOfznvOQJIuJck3X3aAU in birhor
lost lo: मोचा रे अङगुर सुः केते उला in favor of lo1: मोचारे अङगुर सुःकेते उला for IXP6Nz8vJi42LU9BbCFs in birhor
lost lo: हुड़िङ सोङ राः in favor of lo1: हुड़िङ सोङराः for IaKM63LRuvdjeg3whJK3 in birhor
lost lo: मारि नाः किचरिः in favor of lo1: मारिनाः किचरिः for IapeszZJK5ZjzaJLdI46 in birhor
lost lo: पुसि रि होपोन in favor of lo1: पुसिरि होपोन for IwQRXNx8bKfJPTEao01f in birhor
lost lo: पुलिस रि मुनसी तेः in favor of lo1: पुलिसरि मुनसीतेः for J6p2xQN3mMuQ8jLT5T2h in birhor
lost lo: दारु राः माला in favor of lo1: दारुराः माला for J7w2mclmowH7H8nICWfQ in birhor
lost lo: रुआ राः दारु in favor of lo1: रुआराः दारु for JMSyJsHj87PrqNDWu67D in birhor
lost lo: कहानि गपम नाए in favor of lo1: कहानि गपमनाए for JNi48CDxAaxmCyfhjvvc in birhor
lost lo: जोनडरा नाः जाङ in favor of lo1: जोनडरानाः जाङ for JSQznkxbmrJTkrH6MLKb in birhor
lost lo: माड़ि इसिन केते हाटिङेम in favor of lo1: माड़ि इसिनकेते हाटिङेम for JUR7RsvCzqhBnnG31v2N in birhor
lost lo: ऐनेच रा: तांड़ि in favor of lo1: ऐनेचरा: तांड़ि for JVX1WrD9QZuMeQ5hWUVm in birhor
lost lo: खोराः एम in favor of lo1: खोराःएम for Jc632U14i7BjzY9wDyoz in birhor
lost lo: अधाखेचाः in favor of lo1: अधा खेचाः for JeMKQQlf591Wcl6Bb6RF in birhor
lost lo: अङगुरनाःरामा in favor of lo1: अङगुरनाः रामा for K6VnsUIyJwhNziD2BeZn in birhor
lost lo: रामा ते गुदार in favor of lo1: रामाते गोदार for KKgBr5jQWr6kiUYYVKJp in birhor
lost lo: इङतिगि लोटोच इङ in favor of lo1: इङतिगि लोटोचइङ for KZzDoRnWF2DbeJsJa7GY in birhor
lost lo: हेवा नाइ in favor of lo1: हेवानाइ for KhiM27aEWLt4oN5Mn6Dn in birhor
lost lo: निर अचुरोः मि in favor of lo1: निर अचुरोःमि for Kk9gN7MNhvNvosDbjVRh in birhor
lost lo: बोड़ेचइम in favor of lo1: बोड़ेचएम for KwF765yjO3a8w5KxxRAG in birhor
lost lo: जांहाए लोःते in favor of lo1: जांहाएलोःते for KwW1u0IoRX7cDj1Zg4o6 in birhor
lost lo: रिम केते in favor of lo1: रिमकेते for L2E6PZEXKdJhyn1EzJ9m in birhor
lost lo: मियाः मियाः ते जाड़ायेम in favor of lo1: मियाः मियाःते जोड़ायेम for L5j9nwM1s9A3OeCaoozO in birhor
lost lo: तालि सेकम नाः टोपि in favor of lo1: तालि सेकमनाः टोपि for LECQmsRTEeiWqzwlJ2HK in birhor
lost lo: मराङ मेत रि जानवर in favor of lo1: मराङ मेतरि जानवर for LJOLohIZHTfS1jvNeqZK in birhor
lost lo: गाड़ा राः अतोम तेः in favor of lo1: गाड़ाराः अतोमतेः for Lg55SjrAkyNHgtFQGIe3 in birhor
lost lo: ओङ केते सेङगेल जुलेम in favor of lo1: ओङकेते सेङगेल जुलेम for LjpKXJGeA5dDpd8hrmif in birhor
lost lo: टुवार होपोन ओड़ा: दोहो राः in favor of lo1: टुवार होपोन ओड़ा: दोहोराः for Lnmt4eKCpKJGhdJ5eVrW in birhor
lost lo: ओड़ेच इरि कुम in favor of lo1: ओड़ेच इरिकुम for Ltp0lkeMiMSuDs1Ua7QE in birhor
lost lo: ताहि: कोमि in favor of lo1: ताहि:कोमि for LvgbVOm382qtbXhA5RCL in birhor
lost lo: चिलिका ते in favor of lo1: चिलिकाते for M2YRUpk2ngARNY3j5rjN in birhor
lost lo: चिमिन ता in favor of lo1: चिमिनता for M45vs5mhNGYhxjaCPixR in birhor
lost lo: पका नाः in favor of lo1: पकानाः for M460j63NE8FeBFDLWZil in birhor
lost lo: लाहा ते पहिल in favor of lo1: लाहाते पहिल for M7vtfBdlWB1FrWlBUzcX in birhor
lost lo: बिन सारि रे in favor of lo1: बिन सारिरे for M8aGvOKfqZLrL3LGwBdW in birhor
lost lo: भुगा: एम in favor of lo1: भुगा:एम for MRGGiEdvnNLgGVQnjJRr in birhor
lost lo: एटाः होड़ ते भुगाः इचिमि in favor of lo1: एटाः होड़ते भुगाः इचिमि for MTZFT7vBlQyU4SSlaJRe in birhor
lost lo: सिम राः अंडा in favor of lo1: सिमराः अंडा for MZ8lpc7HvGf7cD0ozvv8 in birhor
lost lo: काए दाड़ि येनाय in favor of lo1: काए दाड़ियेनाय for MaWdYzsYwVM58IoLBcnp in birhor
lost lo: सिम नाः मोर ते: in favor of lo1: सिमनाः मोरते: for MjmrqzfMguZz4cQLSDQ3 in birhor
lost lo: इमिनाङ गे in favor of lo1: इमिनाङगे for MpchyiGtgixcePEmIJC0 in birhor
lost lo: हुड़िङ इरि कुम in favor of lo1: हुड़िङ इरिकुम for N2snXUOM62wR0CjsvoLw in birhor
lost lo: सेयाः राः in favor of lo1: सेयाःराः for NQOE4JvR7bYqIzoT6Hzf in birhor
lost lo: ति ते रूएयमि in favor of lo1: तिते रूएयमि for NRLr0eMUJNO1BOaz3l0a in birhor
lost lo: साड़ि इरि कुम in favor of lo1: साड़ि इरिकुम for NTQwFu3xxMQuWLv8kCuE in birhor
lost lo: बेच नाः तवा in favor of lo1: बेचनाः तवा for NXwcBoCWsxZAZWFvktcu in birhor
lost lo: तुत एना in favor of lo1: तुतएना for NcSkBhGRBKPYO2GbeO45 in birhor
lost lo: तोबाः एम in favor of lo1: तोबाःएम for NgVCx18VHCQZFsvjJBkd in birhor
lost lo: अमिन इरि कुम in favor of lo1: अमिन इरिकुम for NjaDZHUcvqHbrfidRoKx in birhor
lost lo: चुलहा ते डेकचि अरगुइमि in favor of lo1: चुलहाते डेकचि अड़गुइमि for No9Q8eZKEsynsoDRVjWa in birhor
lost lo: सहान राः ढिङ in favor of lo1: सहानराः ढिङ for NpVFt8TWCneIjUhsQ3KV in birhor
lost lo: कमबल बाहा in favor of lo1: कमल बाहा for Nt828z9lA9vP22WkgHas in birhor
lost lo: बाहिर इदिम in favor of lo1: बाहिर अगुइमे for NuXobR0f6AsuMZDmX8lq in birhor
lost lo: निकु होड़ राः in favor of lo1: निकु होड़राः for O0cLMjuNar1YkoK758bo in birhor
lost lo: कोड़ा होपोन रा: टाड़ in favor of lo1: कोड़ा होपोनरा: टाड़ for OBqzzGnn6x0ov7Ekc6jl in birhor
lost lo: जवान धिङ हेनाये in favor of lo1: जवान धिङ हेने for OErYa9K12EjXYdmghHww in birhor
lost lo: चिरचिः मि in favor of lo1: चिरचिःमि for OOj9GIhm85EWE1spLGYl in birhor
lost lo: ति ता साकुपेम in favor of lo1: तिता साकुपेम for OPiOpNi2zv63Ul9NNEFZ in birhor
lost lo: एटा: होड़ नाः in favor of lo1: एटा: होड़नाः for OfNRFH4zBPPezdeDJCBf in birhor
lost lo: किचरि: रोः एम in favor of lo1: किचरि: रोःएम for Om3ly4IWfFUgZGjpjNGS in birhor
lost lo: हुचा: एम in favor of lo1: हुचा:एम for Om5yyhkZRLLVfGeTql8y in birhor
lost lo: सुरहि ता खालिमि in favor of lo1: सुरहिता खालिमि for OmkpGXXWfhjqpKIXRsQS in birhor
lost lo: अम राः in favor of lo1: अमराः for Ov7AEv8ei1msVzgJEkKV in birhor
lost lo: जाङ राः तुमबुल in favor of lo1: जाङराः तुमबुल for OwsAzCdAYbXFZkvMqZYi in birhor
lost lo: नोवा दारु ते हाना दारु चुड़िर मे in favor of lo1: नोवा दारुते हाना दारु चुड़िरमे for P5NiNwdjbvBqcuu1A3zB in birhor
lost lo: एटाः होड़ के उमेइमि in favor of lo1: एटाः होड़के उमेइमि for PBQs6GnBmkXW8tP6OGBs in birhor
lost lo: एटाः होड़ नाः उदगर जोतेम in favor of lo1: एटाः होड़नाः उदगर जोतेम for PGI21Mqhez2u5P7ETx7y in birhor
lost lo: सेङगेल ते लोयमि in favor of lo1: सेङगेलते लोयमि for PLXqFjV2nMS7egaXSVgU in birhor
lost lo: दाइल रा: दा: ते: in favor of lo1: दाइलरा: दा:ते: for PYmfLdcYRH8DenUrifJ8 in birhor
lost lo: अनासाल in favor of lo1: अना साल for Psbyf32iD8wZpmmnLcYM in birhor
lost lo: इङ तिगि ति अबुङ in favor of lo1: इङतिगि ति अबुङ for PtjAhvgx35YmbDfPcQvA in birhor
lost lo: कुमहार नाः दोकान in favor of lo1: कुमहारनाः दोकान for PxW5awfMpqpZhInDcnGt in birhor
lost lo: मसाला एम कम in favor of lo1: मसाला एमकम for PxgBHbHQltsxBzFcH3Bm in birhor
lost lo: कयरा रा: दारु in favor of lo1: कयरारा: दारु for QHUhiEKaICJYrFuGaSSD in birhor
lost lo: हुचा: एना in favor of lo1: हुचा:एना for QQTJJ3XOp2XoFZX1HTzJ in birhor
lost lo: दाइङ राः किरिया in favor of lo1: दाइङराः किरिया for QRrqL25s3IsxJhZu59Zt in birhor
lost lo: सुनुम ओजोः एम in favor of lo1: सुनुम ओजोःएम for QXOqoCsMdR1uubdLWGhm in birhor
lost lo: दाः रे बिङ in favor of lo1: दाःरे बिङ for Qjv6eKlnHWQzfQ1MuN1w in birhor
lost lo: बुगिन सोः कना in favor of lo1: बुगिन सोःकना for R0hYQw42alrLXCSugnh1 in birhor
lost lo: दाः रे खुप जुग दुड़ुपमि in favor of lo1: दाःरे खुप जुग दुड़ुपमि for R5BEwDGSQKRNdlNoofTl in birhor
lost lo: बका राः रङ in favor of lo1: बकाराः रङ for RGLTGJVqBui5S54yQcic in birhor
lost lo: बुरु ते हिजुः का रेयड़ होयो in favor of lo1: बुरुते हिजुःका रेयड़ होयो for RTVlKjCYovnMW26CTsvN in birhor
lost lo: सिञजो रा: दारु in favor of lo1: सिञजोरा: दारु for RqtVmQccpYXU4jzBQmqH in birhor
lost lo: हसा राः ओड़ाः in favor of lo1: हसाराः ओड़ाः for RySupkBu3zvNAjSuUATC in birhor
lost lo: सकम रा: फुड़ु: in favor of lo1: सकमरा: फुड़ु: for Rzb0t2mVprNVQyc1mH0Q in birhor
lost lo: दारु राः टाटि in favor of lo1: दारुराः टाटि for RznyVqj9mN7coYOdR7mt in birhor
lost lo: इनाः टिगि in favor of lo1: इनाःटिगि for S7mNYNnuEsayESaeDkeE in birhor
lost lo: सिंजो राः दारु in favor of lo1: सिंजोराः दारु for S9BbsgTMkcC3D6YbyihP in birhor
lost lo: हसा राः भित in favor of lo1: हसानाः भित for SCm7FoquvMKsgM1MXbYV in birhor
lost lo: फिकिरोः मि in favor of lo1: फिकिरोःमि for SLix9Ol185awhkxQg7l0 in birhor
lost lo: कुला राः मोहड़ा in favor of lo1: कुलाराः मोहड़ा for Sjl7ngVIHjka0KKYf8fP in birhor
lost lo: निर घुराः मि in favor of lo1: निर घुराःमि for T4EHEGhvWoozF7QA0ENp in birhor
lost lo: कागज राः खेचाः in favor of lo1: कागजराः खेचाः for TExaIYsiSB9G7XHKqy9o in birhor
lost lo: इङ ठि गोदार निङ in favor of lo1: इङठि गोदारनिङ for TTVF5fnr9NM43TwggyON in birhor
lost lo: जोर ते रुएम in favor of lo1: जोरते रुएमे for TfLtEKhhgLnPPEe1Xx15 in birhor
lost lo: होड़ नाः किचरिः in favor of lo1: होड़नाः किचरिः for TfpZhosPP4z6cZNvmcH2 in birhor
lost lo: जो राः जाङ तेः in favor of lo1: जोराः जाङतेः for TuO3X43QtSPiib10pXPq in birhor
lost lo: थिराओः कोमे in favor of lo1: थिराओःकोमे for Ty1VL2DPP4s9mWctxBHP in birhor
lost lo: सिखा: मि in favor of lo1: सिखा:मि for U5ZbjQ6MWlkTcrUtrfOz in birhor
lost lo: अलाङ रे घाव कनाय in favor of lo1: अलाङरे घाव कनाय for UDiWHOoMbQ9BjdOIaYaR in birhor
lost lo: मुखिया रि एरा तेः in favor of lo1: मुखियारि एरातेः for UEfhIT07EKdZsmj5MpSP in birhor
lost lo: इङ नाः उदगर दाः जोतिङ in favor of lo1: इङनाः उदगर दाः जोतिङ for ULpTKY2w71DmRsADtMXl in birhor
lost lo: होटोः रे गो in favor of lo1: होटोःरे गो for UMwJ4TN5ATtovdsHpR7g in birhor
lost lo: अलाङ रुरुपुवा कनालङ in favor of lo1: अलाङ रुरुपुकनालङ for UfsdOqPnzrXJVAsnhRFW in birhor
lost lo: सिम राः अनडा in favor of lo1: सिमराः अनडा for UkFJ1f7I3tzXaqOc0lBT in birhor
lost lo: गाड़ी राः लादिमि in favor of lo1: गाड़ीराः लादिमि for Up7o831HCDa6GBrNGzx4 in birhor
lost lo: बिर रेन जिलु in favor of lo1: बिररेन जिलु for UpmS7cylKf7eVJXA9UXS in birhor
lost lo: उसात ते लेलेयमि in favor of lo1: उसातते लेलेयमि for UsBe5g7yt5cvSvir6pxb in birhor
lost lo: होटोः राः हार in favor of lo1: होटोःराः माला for UzbIsilT3HUqF6ONRow3 in birhor
lost lo: खिजुर नाः डायर in favor of lo1: खिजुरनाः डायर for V6VKpQKDq3KoJ9nEzsKB in birhor
lost lo: बागि मे in favor of lo1: बागिमे for V7vzUWx3gQUaXa9uKDH1 in birhor
lost lo: सहेत रकपेम अर सहेत अड़गुए मे in favor of lo1: सहेत रकपेम अर सहेत अड़गुएमे for V9MnXyGspzC5sWCedHud in birhor
lost lo: तेलाय राः ढापनि तेः in favor of lo1: तेलायराः ढापनितेः for VMpaZkQGZwbyenkZTe3M in birhor
lost lo: सकम राः टोपी in favor of lo1: सकमराः टोपी for VPlXnwbn5Kncvq9w2O3w in birhor
lost lo: अतु: कना in favor of lo1: अतु:कना for VRIvlGqQtqnfvlTND4of in birhor
lost lo: मकड़ा नाः झालि in favor of lo1: मकड़ानाः झालि for VXA9A83rCZlUXTZIXsLw in birhor
lost lo: दारु राः बकला: in favor of lo1: दारुराः बकला: for VY1no2mpyS95eE0R8FOz in birhor
lost lo: सेन केते अगुइमे in favor of lo1: सेनकेते अगुइमे for VtbPbaZTCikXjJNgU9c5 in birhor
lost lo: होरोमसि रा: छाता in favor of lo1: होरोमसिरा: छाता for WBJu96HVY52nZOFAmVNE in birhor
lost lo: अनडारेदुड़ुपएकानेय in favor of lo1: अनडारे दुड़ुप एकानेय for WMNrDAiROOqCHthkCpi9 in birhor
lost lo: छोलाः एम in favor of lo1: छोलाःएम for WMlebXP56BJAMmEJwsau in birhor
lost lo: मुठा केते खनचि रे दोहेमे in favor of lo1: मुठाकेते खनचिरे दोहेमे for WOrqkEynVrqWsZhOivHj in birhor
lost lo: अजेदकुइञा in favor of lo1: अजेद कुइञा for WgpMaOuvUqAKu3Y208qz in birhor
lost lo: आदि सेकाम in favor of lo1: अदि सेकाम for WgpdWfVcEMo72GxR1MYI in birhor
lost lo: लोलोमि in favor of lo1: लोलोयमि for WmpRYWAYwl5hFpySKrgZ in birhor
lost lo: छुरि अना: चुटि ते: in favor of lo1: छुरिअना: चुटिते: for WtxVZ2qLH5erAACT0bHg in birhor
lost lo: मेत दाः हेच एना in favor of lo1: मेत दाः हेचएना for WugZ1XJ5pjDCADowEk4n in birhor
lost lo: माइ तिन रि माराङ दिदि तेरि होपोन हेरेल ते: in favor of lo1: माइतिनरि माराङ दिदितेरि होपोन हेरेलते: for WvDNu4AQuYtNnaaiQOIa in birhor
lost lo: बुगा: ते जोरो: कना in favor of lo1: बुगा:ते जोरो: कना for XCam8EHa21BlgEdChiWa in birhor
lost lo: सिम ता रा: कनाय in favor of lo1: सिमतारा: कनाय for XHCV5b0LGdA1bPXE6BxF in birhor
lost lo: जहाना: गि लुवेतेम in favor of lo1: जहाना:गि लुवेतेम for XKLoZUo8zfk8oJ0uPUhB in birhor
lost lo: कुड़चुङ केते दुड़ुपमे in favor of lo1: कुड़चुङकेते दुड़ुपमे for XKl5wUtP6f6JJCGam4ez in birhor
lost lo: किचरि: ना: पायर in favor of lo1: किचरि:ना: पायर for XPGt496FcjPcNlTbkOZf in birhor
lost lo: घायला पेड़ेच केते अतुः कना in favor of lo1: घायला पेड़ेचकेते अतुः कना for XZw3Gk0zFK20hSA0xF6E in birhor
lost lo: कुमबड़ु रि परधान in favor of lo1: कुमबड़ुरि परधान for XeR7g3muPuRgk7Vdpqmi in birhor
lost lo: नाति किमिन ते: in favor of lo1: नाति किमिनते: for XhDeIRMAo1GZ3vqJo99y in birhor
lost lo: रङगा नाः in favor of lo1: रङगानाः for Xncqo5JHYH5sYj5tFWIo in birhor
lost lo: खुप पका अना in favor of lo1: खुप पकाअना for Xq4TApB5Y2Z7frQXYex5 in birhor
lost lo: सेटेरोः मि in favor of lo1: सेटेरोःमि for Y1hGPAKdPOvsYfewhfSt in birhor
lost lo: बरिया रा: ताला रे in favor of lo1: बरियारा: तालारे for Y3q7bnsCjCUEn9kqAfxo in birhor
lost lo: मराङ दाइ तेः in favor of lo1: मराङ दाइतेः for YFuY1eQnO7GeFxhDlDod in birhor
lost lo: मेटाव इरि कुम in favor of lo1: मेटाव इरिकुम for YNwWi2owEZPNfhrmQF2S in birhor
lost lo: बोहोः रे दुपिलेम in favor of lo1: बोहोःरे दुपिलेम for YUQj7kn2mZn9cYwm0c9c in birhor
lost lo: मुं ते गपाम कनाय in favor of lo1: मुंते गपाम कनाय for YUSvv4aIjUAqkIXbQ086 in birhor
lost lo: सेताः एना in favor of lo1: सेताःएना for YdlACGbDyoRq7fBmw2y2 in birhor
lost lo: सहान ते जुलेम in favor of lo1: सहानते जुलेम for YroRGWtpz4ff0lGHY4XU in birhor
lost lo: लोकोय जनोः ते सफायमि in favor of lo1: लोकोय जनोःते सफायमि for Z3G4tpinlU78vLN0Bw15 in birhor
lost lo: अजिहानहार in favor of lo1: अजि हानहार for ZH7800cREKmp2Yri9CW9 in birhor
lost lo: जायफर in favor of lo1: जयफल for ZNMfVTI7o4knwA0nJazC in birhor
lost lo: गाड़ि रे गितिच राः ठांय in favor of lo1: गाड़िरे गितिचराः ठांय for ZWmZygcVRqqMEUvNiUPF in birhor
lost lo: बका ते तिकायमे in favor of lo1: बकाते तिकायमे for a4f4UXRMo10RI0sJqXov in birhor
lost lo: हिलाः मि in favor of lo1: हिलाःमि for a5KcMiUjvOFShnoVccoP in birhor
lost lo: जेजेलेत ते लतर अड़गु नाए in favor of lo1: जेजेलेतते लतर अड़गु नाए for a7z3hejv2u9Vggwu7j2M in birhor
lost lo: डुबा कनाये होड़ दो in favor of lo1: डुबा कनाये होड़दो for aDR3B4Z6yYXePmU1UO3P in birhor
lost lo: अटेदतेबिरिदमि in favor of lo1: अटेदते बिरिदमि for aIxrk9nC3x0CR4eACbQJ in birhor
lost lo: मात राः चारिच in favor of lo1: मातराः चारिच for aLE7pNO66RgQzv1fDqTN in birhor
lost lo: अम तिगि सुनुम ओजोः केते मालिसोः मि in favor of lo1: अम तिगि सुनुम ओजोःकेते मालिसोःमि for aR1hCEqiU0nyY7D5WDmR in birhor
lost lo: बनकु गि बनाव in favor of lo1: बनकुगि बनाव for aWU4ZAORSCxSApRScfcb in birhor
lost lo: दतरोम ते हुड़ु इरेम in favor of lo1: दतरोमते हुड़ु इरेम for aX4H17HPmypnDf1XhZBD in birhor
lost lo: तुमबुल नाः सुनुम in favor of lo1: तुमबुलनाः सुनुम for anRJaLMWlKpF5ShnbdRH in birhor
lost lo: बुल केते सिताङ कनाए in favor of lo1: बुलकेते सिताङ कनाए for b64nsWmfkSxOMdK8C5TW in birhor
lost lo: मराङ दिदि तिङ होपोन हेरेल in favor of lo1: मराङ दिदितिङ होपोन हेरेल for bCGbq7X0STeDkR4BPbud in birhor
lost lo: मात नाः पटिया in favor of lo1: मातनाः पटिया for bFFH7fFzpmofZEmlgeCS in birhor
lost lo: ओचोः एमि in favor of lo1: ओचोःएमि for bWMpwB88iuSzgHVHtk46 in birhor
lost lo: हुड़ु नाः ओते in favor of lo1: हुड़ुनाः ओते for bfxa61LiUwmm6Ww6yVmV in birhor
lost lo: पिंजरा तारे सिंङ काएमे in favor of lo1: पिंजरातारे सिंङ काएमे for bjkpIfYHicKSYsDq7KKd in birhor
lost lo: लुतुर ताए गेते एकना in favor of lo1: लुतुरताय गेतेएकना for bsdkNlVL0mWZ9t9ZdTSg in birhor
lost lo: ओकोए ओकोए के in favor of lo1: ओकोए ओकोएके for byTokInuKnc4jf7CRGKZ in birhor
lost lo: अपुञ रि बारे ते: होपोन एरा in favor of lo1: अपुञरि बारेते: होपोन एरा for byffA2BfN9KS6N4AT6Cy in birhor
lost lo: ओचोः एम in favor of lo1: ओचोःएम for c0wL3heOfc31HrxVuP8t in birhor
lost lo: डोरा ते चुकाः ता तोलेम in favor of lo1: डोराते चुकाःता तोलेम for c78CI1NqkD6Eskh8OFd9 in birhor
lost lo: सेटेर ना in favor of lo1: सेटेरना for cEC9fanEQJT3w9JsNZfT in birhor
lost lo: पुंड़ि नाः in favor of lo1: पुंड़िनाः for cQMFCzvqlmuWbdFwZj5i in birhor
lost lo: लुबुः एम in favor of lo1: लुबुःएम for cXmBDokwgLb5RcYyfulL in birhor
lost lo: बारि राः सिनकार in favor of lo1: बारिराः सिनकार for cd9zE5lE98e5ClZ9Eahk in birhor
lost lo: धोति होरोः एम in favor of lo1: धोति होरोःएम for crVB5Xlj7zeu6aKl0FvZ in birhor
lost lo: मुं ते गपम in favor of lo1: मुंते गपम for d2IyZungCPoX38sP7RBi in birhor
lost lo: हसा रा: मराङ चाटु in favor of lo1: हसारा: मराङ चाटु for d2cmEpOBOpD2jD9G1vH2 in birhor
lost lo: मोटाय मि in favor of lo1: मोटायमि for d2jAn8m8Tf1GQm2tvDNt in birhor
lost lo: चटाः इमे in favor of lo1: चटाःइमे for dS4eSDofBIhUMDW5XFN4 in birhor
lost lo: जांहाए किगि in favor of lo1: जांहाएकिगि for dYCUDY3dSKD9AZ7b3g2v in birhor
lost lo: चोः एमि in favor of lo1: चोःएमि for dYMRR6m5yMoWyYgoalkB in birhor
lost lo: बिर राः ओते in favor of lo1: बिरराः ओते for da0nwQkyckbfp6zfOJpv in birhor
lost lo: बुसु रा: बिंडा ते: in favor of lo1: बुसुरा: बिंडाते: for dd9gDAgiezCttPswK0C8 in birhor
lost lo: जांहे ते सांजु कम in favor of lo1: जांहेते सांजु कम for dgBqu0hg4wR2zEenX1xB in birhor
lost lo: मसाला ता मिलायेमि in favor of lo1: मसालाता मिलायेमि for dp5sDwC7ZQcqRnDj7vyd in birhor
lost lo: अम ते in favor of lo1: अमते for dxkUQ7sCCBUViLRNYcTe in birhor
lost lo: बायेर उञ एम in favor of lo1: बायेर उञएम for e9lYfP3xOzofrPEXIAkz in birhor
lost lo: घसकाः मि in favor of lo1: घसकाःमे for eA80DoXuTHXmTjMvig2p in birhor
lost lo: थिराः मि in favor of lo1: थिराःमि for eGIXnzM7MBxZxd46KwnW in birhor
lost lo: तोगोच इरि दियम in favor of lo1: तोगोच इरिदियम for eOms427SzSkAImfnce1x in birhor
lost lo: गुचु होयो राः छुरि in favor of lo1: गुचु होयोराः छुरि for ePKagJZ5aFCd1CYaxrNH in birhor
lost lo: उम इरि एम in favor of lo1: उम इरिएम for egs5DFYxOWQsTxRkYTxk in birhor
lost lo: अम के in favor of lo1: अमके for evhh0vzdCycIez0k9QpG in birhor
lost lo: दुड़ुप नाः in favor of lo1: दुड़ुपनाः for f03nFrEbIAqRuDTbIawE in birhor
lost lo: सकम राः पाकिट in favor of lo1: सकमराः पाकिट for fDia26jRq9MjWluohy16 in birhor
lost lo: लउका चलाओ: नि: in favor of lo1: लउका चलाओनि: for fE9NC64BDNs4DqjsML5c in birhor
lost lo: सिरमा रि राजा in favor of lo1: सिरमारि राजा for fIoDTsPwk427LVN8KxUF in birhor
lost lo: नरियाल छोला राः छुरि in favor of lo1: नरियाल छोलाराः छुरि for fVGG7LoEnKwqJU3vYMYM in birhor
lost lo: उनि के उकुयेम in favor of lo1: उनिके उकुयेम for fl7imh7ItZ6ug1tVLDSY in birhor
lost lo: ति ते साबेमि in favor of lo1: तिते साबेमि for fnD8U3gVCsJsT9d419ko in birhor
lost lo: एटाः होड़ के उमाइमि in favor of lo1: एटाः होड़के उमाइमि for fnH7hg3d2Q3w4NJGfWkp in birhor
lost lo: मेत राः राजा ते: in favor of lo1: मेतराः राजाते: for gG75HS7ONKqPvqxWvyva in birhor
lost lo: चेंड़ें ता अड़ाः काइमि in favor of lo1: चेंड़ेंता अड़ाःकाइमि for gGNhiSrg51K8Up9Lg7Ss in birhor
lost lo: सोबोः एम in favor of lo1: सोबोःएम for gMLEvvoFp4DAFPdp9VMX in birhor
lost lo: अले के in favor of lo1: अलेके for gPpBjRrTI5yU8MkyRzHB in birhor
lost lo: अजिरिएङगातेः in favor of lo1: अजिरि एङगातेः for gRFJgkAYwZK3mN8fQtxb in birhor
lost lo: जांहाए गि in favor of lo1: जांहाएगि for gljHpZxkVEDmOKk2kCcX in birhor
lost lo: उप रे बाहा लगायेम in favor of lo1: उपरे बाहा लगायेम for h0WWFhWaYjFDdGo7ZKdT in birhor
lost lo: बचाव ना in favor of lo1: बचावना for h4d4FXijAdGs7RuQMsUy in birhor
lost lo: पहिल रे in favor of lo1: पहिलरे for hBscIHU1fGxwN0yr2mxi in birhor
lost lo: अहुंट उदुब कनाय in favor of lo1: अहुंट उदुबकनाय for hMO5D6gQXuHihb1McoeS in birhor
lost lo: बिन बपला रि in favor of lo1: बिन बपलारि for hSaGffzJdu0OLP2yZaIv in birhor
lost lo: हाकु राः चेंया: in favor of lo1: हाकुराः चेंया: for hbKnvzI8jymuyFYSJyAn in birhor
lost lo: तालि सेकम नाः सुपेत in favor of lo1: तालि सेकमनाः सुपेत for hf9Ued39HdFj1fmFK2KU in birhor
lost lo: सोबिन ते हुड़िङ in favor of lo1: सोबिनते हुड़िङ for hfbQHBHoBNF3ilFlY4eA in birhor
lost lo: जोजो अना in favor of lo1: जोजोअना for hnDzbZJ4B7p258kuVCgR in birhor
lost lo: हड़ाम काड़ा राः डाटा in favor of lo1: हड़ाम काड़ाराः डाटा for hoL34RnbLApzEUCJUjqU in birhor
lost lo: हातु रि मुखिया in favor of lo1: हातुरि मुखिया for hofUJnrIvpgJowOxCFlv in birhor
lost lo: एटाः होड़ नाः मोचा अबुङ in favor of lo1: एटाः होड़नाः मोचा अबुङ for hprWlrIETyCE0OC3a1ML in birhor
lost lo: होपोन हेरेल नि नाति तेः in favor of lo1: होपोन हेरेलनि नातितेः for hzRe0LJ7heRtBKXelXyG in birhor
lost lo: बुसुः ते डोरा बनायेम in favor of lo1: बुसुःते डोरा बनायेम for iJ7Y2kxFIpbIVn83R6nd in birhor
lost lo: हुरकुचाः मि in favor of lo1: हुरकुचाःमि for iMwmfyRPkp48USfQgeuy in birhor
lost lo: बुसु रा: बिनडा ते: in favor of lo1: बुसुरा: बिनडाते: for iOnmgfT8P0xfnGATyMzl in birhor
lost lo: होड़मो रे बोङगा खोदा in favor of lo1: होड़मोरे बोङगा खोदा for iV09hvm096TaFEpVvCLC in birhor
lost lo: नोड़ो हिजु मि in favor of lo1: नोड़ो हिजुमि for iczpnhITw9qAGAQkE4uG in birhor
lost lo: काए अये in favor of lo1: काएअये for idlAT7NntgJdGuK4X89U in birhor
lost lo: सकम रा: खालाः in favor of lo1: सकमरा: खालाः for igQ6nS9tkk4IuZ7ymoZb in birhor
lost lo: रेहेत तेराः चुटि तेः in favor of lo1: रेहेत तेराः चुटितेः for ii7217RRMbKyDNkjepdH in birhor
lost lo: ति राः गरहन in favor of lo1: तिराः गरहन for imiLoYQAj3MUgP8H3vej in birhor
lost lo: ओड़ा: ता पुंड़ि कन in favor of lo1: ओड़ा:ता पुंड़ि कन for iwxkEIZaAYK7w8aMEvxq in birhor
lost lo: रुरुङ केते चोकाः ते ओचो: एम in favor of lo1: रुरुङकेते चोकाःते ओचो:एम for ixJd4kAu7OCe03UpIRti in birhor
lost lo: बका राः रामा in favor of lo1: बकाराः रामा for j1DHtvTy5ZrufKFw6DQQ in birhor
lost lo: मात रा: टोपा: in favor of lo1: मातरा: टोपा: for j9tIMPXYgKjNbaT2W6TH in birhor
lost lo: मो ना in favor of lo1: मोना for jGjEBfjtX9JHRX55tZyt in birhor
lost lo: बुसु: राः गेंठ in favor of lo1: बुसु:राः गेंठ for jRDHS6EceB6X2RezY4rc in birhor
lost lo: जंहाए ते लतार in favor of lo1: जंहाएते लतार for jTc4BaddEls73ahRzYjy in birhor
lost lo: जांहा रिगि in favor of lo1: जांहारिगि for jUvfOwqNHvWYWOvdyn5H in birhor
lost lo: होपोन ताके हेबेयमि in favor of lo1: होपोनताके हेबेयमि for jYcYfmnMSrH601ywmdTC in birhor
lost lo: ताहि: लेनाए in favor of lo1: ताहि:लेनाए for jZfacKlO6nQgbBDUNDHR in birhor
lost lo: चपटा मु री होड़ in favor of lo1: चपटा मुरी होड़ for jcbz3w2O08hiuPPtdM5U in birhor
lost lo: एटाः रे दोहो in favor of lo1: एटाःरे दोहो for jcrXV9if6hsKQlUJ6Jrj in birhor
lost lo: अपु तेरि अपु तेः in favor of lo1: अपुतेरि अपुतेः for jgJNEvZdcjWIJj5lpkhQ in birhor
lost lo: तिङु: मि in favor of lo1: तिङु:मे for jjFIyvvFeEZsa2EJDApF in birhor
lost lo: इङ गे in favor of lo1: इङगे for jjGSMqiu9yM9tgDAyuim in birhor
lost lo: एटाः होड़ के ओजोः येमि in favor of lo1: एटाः होड़के ओजोःयेमि for joPX4KzxDJUyRvDDdX1i in birhor
lost lo: इङ के in favor of lo1: इङके for k3xl1ixSTkLTtJHblyyS in birhor
lost lo: अम नाः in favor of lo1: अमनाः for kDfCTwVpJ9CcCmvqPgBP in birhor
lost lo: एटाः होड़ नाः बका अबुङ in favor of lo1: एटाः होड़नाः बका अबुङ for kNG3k9XoTT6jyS4vW9zr in birhor
lost lo: खारे रा: खुनटा in favor of lo1: खारेरा: खुनटा for kQ2Y1xYMO9EcWNCpgepd in birhor
lost lo: बुसुः राः छहनिम in favor of lo1: बुसुःराः छहनिम for kQrjXK28X9LXrdpUi8Yx in birhor
lost lo: हिजुः मि in favor of lo1: हिजुःमि for kZmdY15PU28KWPbU3wny in birhor
lost lo: ताहि: अना ओड़ा: in favor of lo1: ताहि:अना ओड़ा: for kdPV9xBhjkadNidK7mVl in birhor
lost lo: चिरगारो: मे in favor of lo1: चिरगारो:मे for kea78CQmyLsuytyHlsuC in birhor
lost lo: हुड़ु दोहो ना: ओड़ा: in favor of lo1: हुड़ु दोहोना: ओड़ा: for kewlXCbzf7DfvrWSkBDZ in birhor
lost lo: हथजोड़ in favor of lo1: हठजोड़ for kh7O4atx2XqroLCLdypE in birhor
lost lo: बिर रि सुकड़ि in favor of lo1: बिररि सुकड़ि for ksJZulS9lhSKH6C1wZnV in birhor
lost lo: ताइनोम रे in favor of lo1: ताइनोमरे for kwhh4mjuZu3D6bqXH4DK in birhor
lost lo: ति राः गेंठ in favor of lo1: तिराः गेंठ for l0q4JG5HNKiiFlD1zop6 in birhor
lost lo: सो: एमि in favor of lo1: सो:एमि for l17DNUXo4q2VFe5V04p1 in birhor
lost lo: सकम राः छाता in favor of lo1: सकमराः छाता for lGYpGk3aog0o05SDZGx5 in birhor
lost lo: तायनोम ते in favor of lo1: तायनोमते for lNGPLfBGw35QoC2flom6 in birhor
lost lo: एटाः होड़ लो: झोगड़ामि in favor of lo1: एटाः होड़लो: झोगड़ामि for lTooG15aj9lOHymqqE39 in birhor
lost lo: सुकड़ि राः मु in favor of lo1: सुकड़िराः मु for lw0QNVneZclEL3BDLMRd in birhor
lost lo: हुड़ु राः मोटरा in favor of lo1: हुड़ुराः मोटरा for lz6kHXlCnrSb98oHv9Tz in birhor
lost lo: चाउलि नाः होलोङ in favor of lo1: चाउलिनाः होलोङ for m01ORjwdbpZVG52auVdn in birhor
lost lo: अले अतोम रि in favor of lo1: अले अतोमरि for m6AoWoDayHCYtWzH48qR in birhor
lost lo: अचारबनाम in favor of lo1: अचार बनाम for m6e05EwXfbCO8B4sKGpx in birhor
lost lo: खपरोहि राः जाङ in favor of lo1: खपरोहिराः जाङ for m76AVu7Iw1gz2tCyLk7U in birhor
lost lo: मात राः डपठु in favor of lo1: मातराः डपठु for mOqnFqeIQmC3wMyClmib in birhor
lost lo: किचरि: ते उयु नाय in favor of lo1: किचरि:ते उयुनाय for mQegPvt6yBvEiji5UUjl in birhor
lost lo: असथिर ता गपमएम in favor of lo1: असथिरता गपमएम for mWEP3sbHm7HRs14N5rV1 in birhor
lost lo: सुनुम लोः सुयेतेम in favor of lo1: सुनुमलोः सुयेतेम for mWewygtvLI3BicJmle2K in birhor
lost lo: हना रे in favor of lo1: हनारे for mZ29biR908rHzm54Gxp8 in birhor
lost lo: हसा ते एसेत in favor of lo1: हसाते एसेत for mcQaM1WtQRzM9SojyrWD in birhor
lost lo: बका ते ओता in favor of lo1: बकाते ओता for mgRwLA1V3QGsKshTYUpb in birhor
lost lo: नानहाः मि in favor of lo1: नानहाःमि for mjyB2ycuiDlkkcvwvBDO in birhor
lost lo: हुड़ु दोहो रा: मराङ खानचि in favor of lo1: हुड़ु दोहोरा: मराङ खानचि for mx44ypVc3Nfrcubsm1aR in birhor
lost lo: जोर लगाव केते धाकाएम in favor of lo1: जोर लगावकेते धाकाएम for n48AFwg8UijF1QnJpqRz in birhor
lost lo: अपे सोबिन होड़ लोः in favor of lo1: अपे सोबिन होड़लोः for neb5pq2sisxV1sv7FDJz in birhor
lost lo: पुलिस रे इस्पेक्टर in favor of lo1: पुलिसरे इस्पेक्टर for nj4idRQR1y7U5IyXtTLN in birhor
lost lo: उकड़ुम केते दुड़ुपमि in favor of lo1: उकड़ुमकेते दुड़ुपमि for np8d1ByE44kt7t5SRhVh in birhor
lost lo: इङ अर हेरेल तिङ रे हुडिङ बारे तेः in favor of lo1: इङ अर हेरेल तिङरे हुडिङ बारेतेः for nrTRYS32ep8O2FxzTLxM in birhor
lost lo: मात रा: पेटिया in favor of lo1: मातरा: पेटिया for nybm5FGE14hR0ZH3TFRv in birhor
lost lo: मात राः निसान in favor of lo1: मातराः निसान for oCzozMDdovMYpouIa4qt in birhor
lost lo: सेङगेल रे लो केते इसिनेम in favor of lo1: सेङगेलरे लोकेते इसिनेम for oMD8ZoWxfyBqzKi6dlnJ in birhor
lost lo: रामा ते राबुड़ काइमे in favor of lo1: रामाते राबुड़ काइमे for oQ9whJXJMRFJvFs1U9uZ in birhor
lost lo: होरोः एम in favor of lo1: होरोःएम for oSQn6ncec6GxPb5stT0W in birhor
lost lo: अबेन बार होड़ के in favor of lo1: अबेन बार होड़के for oWpaFHgp45vR3aXhP4sH in birhor
lost lo: ठोःठोः एम in favor of lo1: ठोःठोःएम for oXGzQbQhzsVsTjPPTIIg in birhor
lost lo: झुला होरोः इरि कोम in favor of lo1: झुला होरोः इरिकोम for ofaijxQLnXTfGkJKtB7Q in birhor
lost lo: हेनदे ठेङा ते रुवेयमि in favor of lo1: हेनदे ठेङाते रुवेयमि for p0t9fSL9wjFx1kE9wXpm in birhor
lost lo: घेयला रा: खेचा: ते: in favor of lo1: घेयलारा: खेचा:ते: for p6sum4sehaWJQ9rzDEBL in birhor
lost lo: हेच रुवाड़ो: मे in favor of lo1: हेच रुवाड़ो:मे for p8hrwWdYGlqs3kD3VRGe in birhor
lost lo: करछुल ते घेटायमे in favor of lo1: करछुलते घेटायमे for p9B0j11D1d2B8u97ZuWP in birhor
lost lo: कुड़ि ता हराओ नाय in favor of lo1: कुड़िता हराओनाय for pDEB2FDrbyDRWyY4Giu8 in birhor
lost lo: सिङ येना in favor of lo1: सिङयेना for pIgPsFiT8FGCWWsipTl3 in birhor
lost lo: मुच रा: बुनुम in favor of lo1: मुचरा: बुनुम for pOCLU5cKZCcwgDeeWAZK in birhor
lost lo: इसिन नाः in favor of lo1: इसिननाः for pP4JS6Byb91RdkZFqJsC in birhor
lost lo: अपे सोबिन ते in favor of lo1: अपे सोबिनते for pUAUMYbdYHceh6Yqj4CA in birhor
lost lo: उबरा सुबरा तेः in favor of lo1: उबरा सुबरातेः for pVcJan5gA0ZSHWX1anwc in birhor
lost lo: होटोः राः जाङ in favor of lo1: होटोःराः जाङ for pbTSTqQJ50IXvvlyzE8I in birhor
lost lo: साकुप राः in favor of lo1: साकुपराः for q1nXgDLNh9OnWeND1fbZ in birhor
lost lo: मारि किचरि रा: टुकड़ा in favor of lo1: मारि किचरिरा: टुकड़ा for q5Ds6SgmmyYL2d53mzyN in birhor
lost lo: हुड़िङ बारेत तेः in favor of lo1: हुड़िङ बारेततेः for q9JOXsejI1vTmX2OeVH3 in birhor
lost lo: ओकोए राः in favor of lo1: ओकोएराः for qH5L7tVMPb8vjLw4GdDq in birhor
lost lo: ताला बारेत ते: in favor of lo1: ताला बारेतते: for qRVhd8vjaf4wnJin6Irn in birhor
lost lo: तिहिन ते in favor of lo1: तिहिनते for qTxi4L8qcYABL2cgrDm4 in birhor
lost lo: लाहा ते in favor of lo1: लाहाते for qirWQlDzpiQ2HxDWNh4f in birhor
lost lo: एटाः एनि in favor of lo1: एटाःएनि for qruvxJP3iQAAzl40BdP4 in birhor
lost lo: छिटका वायमि in favor of lo1: छिटकावायमि for qu5Bbig7XC34cvoJOES9 in birhor
lost lo: रिमिल उमबुल काय in favor of lo1: रिमिल उमबुलकाय for qvfr2BjIpXYFsQTOqAh1 in birhor
lost lo: आ: ना: डोरा in favor of lo1: आ:ना: डोरा for qznrFVco23fBM8CxTnqv in birhor
lost lo: दारु राः निसान in favor of lo1: दारुराः निसान for rBCNEdEc4aDsL8WSrA5c in birhor
lost lo: जहाँ लेका ते in favor of lo1: जहाँ लेकाते for rBwznP0Zi8XKbmlRrKH6 in birhor
lost lo: बलबल नाय in favor of lo1: बलबलनाय for rCwKkAdvW5bjY6tTtuZS in birhor
lost lo: बिर राः हुड़िङ होरा in favor of lo1: बिरराः हुड़िङ होरा for rFnVEtCYnfuMSaXG4unq in birhor
lost lo: गपाम मि in favor of lo1: गपाममि for rTTf05RAcC1N9wskA8Du in birhor
lost lo: उतु गेत राः जिनिस in favor of lo1: उतु गेतराः जिनिस for rXkSil7VSOMJhHBk8dbS in birhor
lost lo: कागज राः ढेर in favor of lo1: कागजराः ढेर for rciu2DH1SU5859ZEhE1V in birhor
lost lo: तलवार नाः खोलि तेः in favor of lo1: तलवारनाः खोलितेः for rnPFU0LmBn7YylzWL5Mg in birhor
lost lo: छत राः चेतान तेः in favor of lo1: छतराः चेतानतेः for rucpAazklALV0wxqEMzv in birhor
lost lo: गितिल ते पेड़ेच एका in favor of lo1: गितिलते पेड़ेचएका for rwQjbESZdS6p9TzUqOT6 in birhor
lost lo: गुलाब रङ राः in favor of lo1: गुलाब रङराः for rxYIs1nYvTzq5KwKoODq in birhor
lost lo: खिस ता हापे नाम in favor of lo1: खिसता हापेनाम for s5HpBLJJfqUHcfAeyNf6 in birhor
lost lo: हेच रुआड़ो: मे in favor of lo1: हेच रुआड़ो:मे for sWKVevCIiwkCE4yjLaAD in birhor
lost lo: हुड़ु रा: बिनडा in favor of lo1: हुड़ुरा: बिनडा for srIRdSgHDx2BMqfsO5HR in birhor
lost lo: बोङगा अरि रे तबेर जोहार in favor of lo1: बोङगा अरिरे तबेर जोहार for t9E2L4qIK1HShHg68sT4 in birhor
lost lo: बेगर सकम राः दारु in favor of lo1: बेगर सकमराः दारु for tGMv1yrBlxR0IaMcvfc8 in birhor
lost lo: इमिन ता: in favor of lo1: इमिनता: for tRdrvI8SIKjGjUFKSokf in birhor
lost lo: ओते रि मालिक in favor of lo1: ओतेरि मालिक for tUl3wJNuWFFlg6zlclX1 in birhor
lost lo: गुलाब रङ नाः in favor of lo1: गुलाब रङनाः for tYBSi5W66HyDSgTRLO1e in birhor
lost lo: बेरेल नाः in favor of lo1: बेरेलनाः for tuL88zFK82W2j0XlId9Y in birhor
lost lo: इङ तिगि बका अबुङ in favor of lo1: इङतिगि बका अबुङ for twOcku14a09DiQBFghRx in birhor
lost lo: सकम राः मारङ फुड़ु in favor of lo1: सकमराः मारङ फुड़ु for twbBojIfFKrxeNgA3D9z in birhor
lost lo: गुरिच रेन उरु in favor of lo1: गुरिचरेन उरु for u5Y6WbNHvGFDyvDH6GRL in birhor
lost lo: पगड़ि तोलुः मि in favor of lo1: पगड़ि तोलुःमि for uUt4Fd9wJlQ0IhJmXMVO in birhor
lost lo: सुकरि राः मु in favor of lo1: सुकरिराः मु for um6AhVxmRUDLvEIygjWo in birhor
lost lo: गाविच एयमि in favor of lo1: गाविचएयमि for unKAd3ZhEsp7Prufa8lt in birhor
lost lo: बुझाः मि in favor of lo1: बुझाःमि for v2RmpKVWe8MH2sNSkX64 in birhor
lost lo: बाहा राः रास in favor of lo1: बाहाराः रास for vBCbPchUgkZNgs8dYj9Q in birhor
lost lo: तागोच रा: तारु डाटा in favor of lo1: तागोचरा: तारु डाटा for vChJ1fwdJMbKaG2kH7dR in birhor
lost lo: कठाड़ ना: गुदा ते: in favor of lo1: कठाड़ना: गुदाते: for vCvPXd0ARzUcFEpJziHD in birhor
lost lo: सोबिन ते पहिल in favor of lo1: सोबिनते पहिल for vGW9WnRlcsKXrJmmgYzY in birhor
lost lo: बिर राः बुरु रे कुहास in favor of lo1: बिरराः बुरुरे कुहास for vPuwv6vRXVVXtvDc8InC in birhor
lost lo: बोङगा इरि क़ुम in favor of lo1: बोङगा इरिक़ुम for vSpvS4kEIz6OfiYHJ80Z in birhor
lost lo: कुमबा राः छत in favor of lo1: कुमबाराः छत for vWRPHqT3f0BQsbBxAQLz in birhor
lost lo: रिमबिल उमबुल काय in favor of lo1: रिमबिल उमबुलकाय for vX3ZIYd2OTFvC6AYqzoP in birhor
lost lo: सारा ते: in favor of lo1: साराते: for vajHB1enD8xOtMxUEddX in birhor
lost lo: अचारबायाम in favor of lo1: अचार बायाम for vdv9iUMo943BtI4GJ3jI in birhor
lost lo: बोथड़ो ना: in favor of lo1: बोथड़ोना: for vhfAlG5xh2UWV29m7Sub in birhor
lost lo: आत तितिङ in favor of lo1: आततितिङ for vjSkySASoTfZJAwUEt6r in birhor
lost lo: सेया ना in favor of lo1: सेयाना for vzhbLAgeQ7Qm0zqvQotK in birhor
lost lo: दाः दुल नाः माड़ि in favor of lo1: दाः दुलनाः माड़ि for w539neOai0YsEcytDwz6 in birhor
lost lo: मात रा: खांडा in favor of lo1: मातरा: खांडा for w661r38pVTXYJWrrQLYP in birhor
lost lo: ढापनि ओचोः एम in favor of lo1: ढापनि ओचोःएम for w6fMaMbV1NQP0yoLaxRG in birhor
lost lo: लुतुर राः कारठि in favor of lo1: लुतुरराः कारठि for wAOVJVCS4Quxk5hOkCcu in birhor
lost lo: बका राः अङुर in favor of lo1: बकाराः अङुर for wCQxts3U3rxbxaJcI3H2 in birhor
lost lo: मात रा: टाटि in favor of lo1: मातरा: टाटि for wGXytaaRHFv76RMXwSNl in birhor
lost lo: खुः एम in favor of lo1: खुःएम for wTtpIiyu5cz3SPN6PCvc in birhor
lost lo: जाहना: गे टेनडारेम in favor of lo1: जाहना:गे टेनडारेम for wYnEsD0WLDWbWi7Ra6pH in birhor
lost lo: खिज़ुर नाः पटिया in favor of lo1: खिज़ुरनाः पटिया for wbc91REjyU5qrpkaMsVf in birhor
lost lo: एटा: होड़ के ओरेम in favor of lo1: एटा: होड़के ओरेम for wdIAl56L4Q6Qvdlahm5c in birhor
lost lo: मदकोम राः कोएंडि जाङ तेः in favor of lo1: मदकोमराः कोएंडि जाङतेः for wy1CWG9Gt2UKCoVKY8yk in birhor
lost lo: खिजुर दारु कानि ते: in favor of lo1: खिजुर दारु कानिते: for x2yxEs4MoHrykeRzl4Qe in birhor
lost lo: हथा जोड़ि in favor of lo1: हठा जोड़ि for xHBaLzW79X7uLJFTGetu in birhor
lost lo: ओकोए के in favor of lo1: ओकोएके for xPBoONY0bO600Vz1cuMh in birhor
lost lo: सोङ राः हुड़िङ खाचि in favor of lo1: सोङराः हुड़िङ खाचि for xbTV3s9vlAYXGapyWiBp in birhor
lost lo: हिला: मे in favor of lo1: हिला:मे for xsCQPZcvtVjy1DES50Su in birhor
lost lo: कुला राः पानजा in favor of lo1: कुलाराः पानजा for xvVG4ACpMzoU63NuiORt in birhor
lost lo: दा: रे ढेर जुग दुड़ुपमि in favor of lo1: दा:रे ढेर जुग दुड़ुपमि for yJAfSCcdQ3K04hDsUT9x in birhor
lost lo: मात रा: दुएर in favor of lo1: मातरा: दुएर for yOBIJ4lQya5jbEWdzsPF in birhor
lost lo: लाहा रे in favor of lo1: लाहारे for yaqZkzfIFsvfZ6X75PYs in birhor
lost lo: कारेये ते in favor of lo1: कारेयेते for ysLIa2T1vUKONX2uUkc9 in birhor
lost lo: ओते रे तोपा दियाय in favor of lo1: ओतेरे तोपा दियाय for ywlzWEy6N1k3X83QO8t1 in birhor
lost lo: काए दाड़ि येना in favor of lo1: काए दाड़ियेना for z8QpPA7thzjJuGsuF0A1 in birhor
lost lo: एटाः होड़ के राबुड़ काइमि in favor of lo1: एटाः होड़के राबुड़काइमि for zFWhwA5gpHioZLpFmklx in birhor
lost lo: हुड़िङ मात नाः खाचि in favor of lo1: हुड़िङ मातनाः खाचि for zPostt6ghPTg1HMSy7w2 in birhor
lost lo: देरि ना in favor of lo1: देरिना for zaxuCPX7PFNvGhWSK4oW in birhor
lost lo: अड़ाइदिन in favor of lo1: अड़ाइ दिन for zlqvMlHaFCCX2kvkXGnl in birhor
lost lo: गोसुवाओ ना in favor of lo1: गोसुवाओना for zmZCuRj9uXPOCUaCeMyw in birhor
lost lo: दतरोम ते इरेम in favor of lo1: दतरोमते इरेम for zr0aukQqPgGrMA5D7Jal in birhor

lost lo: armonieh in favor of lo1: armonye for 13CWACNDOVjEmxAHVT1m in jewish-neo-aramaic
lost lo: maml'kat in favor of lo1: maml'kat esra'el for 3LS9VHdm5wTWsCIO2IAs in jewish-neo-aramaic
lost lo: j'lexle in favor of lo1: xikle for 4w1vnFjEz1KRPpSQgqnW in jewish-neo-aramaic
lost lo: gardesh in favor of lo1: čiara for 9zT822ToZGod2bHNLJhT in jewish-neo-aramaic
lost lo: xodkar in favor of lo1: qalam for AZLLJ5mdtJPQlIOCrCdc in jewish-neo-aramaic
lost lo: haya in favor of lo1: haya-haya for AeI29aTgAznaxVdGb1g5 in jewish-neo-aramaic
lost lo: shluq in favor of lo1: šluq for AjPPiIWnuPAS9RP6MhvC in jewish-neo-aramaic
lost lo: haya in favor of lo1: baqarvula for AuFI8lpseF6j4Dn0nNsE in jewish-neo-aramaic
lost lo: qalam in favor of lo1: madad for CNYz5uTEZralChR55fHr in jewish-neo-aramaic
lost lo: bassireh in favor of lo1: basire for DbHh9gMjJ2OmXNLR5ybe in jewish-neo-aramaic
lost lo: xayula in favor of lo1: xa'ula for FFY0RiuWJZdI3dfhk81X in jewish-neo-aramaic
lost lo: e'ssga in favor of lo1: esga for Geo6WcG6tPHbLoe0Rcm2 in jewish-neo-aramaic
lost lo: komeh in favor of lo1: xšixe for GxybsuwYeVBRbMSiGCFU in jewish-neo-aramaic
lost lo: otaǧ in favor of lo1: otaq for HhGaOzsiT0agiF9NGFw1 in jewish-neo-aramaic
lost lo: bachod in favor of lo1: sâda for JPtiZS4rleO8bJReKiyM in jewish-neo-aramaic
lost lo: rixef xrivai in favor of lo1: ms'rya for Kbugl3fTM8GSz6uW60ir in jewish-neo-aramaic
lost lo: shakat in favor of lo1: šakat for MfSNiht3bRU7i4g1vAZG in jewish-neo-aramaic
lost lo: bassima in favor of lo1: salem for Mho9O6SvarMSk8qA7Ye0 in jewish-neo-aramaic
lost lo: banafsh in favor of lo1: banafš for NyYyt0aY00LxG4W6I3T2 in jewish-neo-aramaic
lost lo: xa rob in favor of lo1: q'ta for OQf6ZR9CMcpLSXVsYsX3 in jewish-neo-aramaic
lost lo: xitale in favor of lo1: xitle for PVtWleDpiPBz70D8tjsG in jewish-neo-aramaic
lost lo: bassima in favor of lo1: basima for SOBsQ8koxWyyNhz7MqSj in jewish-neo-aramaic
lost lo: tuqa in favor of lo1: tu'qa for SbLFTZALXNDeIij8EtHE in jewish-neo-aramaic
lost lo: hošyar in favor of lo1: alyana for TRsiZib8GZW9vXEGfGSw in jewish-neo-aramaic
lost lo: esfenač in favor of lo1: esfenaj for UOnv2e0gVbPte2jFnCtV in jewish-neo-aramaic
lost lo: daynula in favor of lo1: dayna for US6FEA10Y8aRVsGiRnqg in jewish-neo-aramaic
lost lo: rakta in favor of lo1: raqta for V1XLUj0Bqqu0JTcweD1j in jewish-neo-aramaic
lost lo: evy'ta in favor of lo1: evya for VaEPzquI1Czga1yXeruc in jewish-neo-aramaic
lost lo: class in favor of lo1: klas for WYRoZetRH3Lbj03BSPqK in jewish-neo-aramaic
lost lo: babasimula in favor of lo1: elha ya'rizox havel for WZfGJJpdtRqBpmCEfyep in jewish-neo-aramaic
lost lo: olam hiya'a in favor of lo1: olam hiya for WvrgymN8pp4o5SAA2zx3 in jewish-neo-aramaic
lost lo: darya in favor of lo1: yama for XPP79zDynF6MAH48vHwe in jewish-neo-aramaic
lost lo: mešile in favor of lo1: mešenile for Y5WWmyuiSy1eQZByKp7R in jewish-neo-aramaic
lost lo: šalvaleh k'rye in favor of lo1: šelvaleh k'rye for YIxfLUJAu47gjrx2AB2l in jewish-neo-aramaic
lost lo: tut in favor of lo1: t'le for YYLclErMBaguV7i55DVq in jewish-neo-aramaic
lost lo: z'deli in favor of lo1: z'de for YxrS83WVDkDTKukOn156 in jewish-neo-aramaic
lost lo: bezahemta in favor of lo1: be zahemta for ZQW6PJT7Y4Y1zpcQo0ZG in jewish-neo-aramaic
lost lo: lash in favor of lo1: laš for ewhta2dUEF6NLGv6CPnw in jewish-neo-aramaic
lost lo: zeituna in favor of lo1: zeitun for f52FLMHasDRg8BqZKrSy in jewish-neo-aramaic
lost lo: banana in favor of lo1: mouz for fCmP39unVaGJAq5m6gWu in jewish-neo-aramaic
lost lo: šalvaleh in favor of lo1: šelvaleh for mQ97Lj6ktVTtzYX3uDtN in jewish-neo-aramaic
lost lo: ilmi in favor of lo1: ilma for miVn1ko3ngN3JZuxZ0yF in jewish-neo-aramaic
lost lo: qatoo in favor of lo1: qatu for o4EV2HgCp7UzEoxjp9nV in jewish-neo-aramaic
lost lo: armonieh in favor of lo1: armote for xQpi9WCFS9DonwGqoL8T in jewish-neo-aramaic
lost lo: q'lye in favor of lo1: qil for zp4M22FStBQQ8YmvCQAu in jewish-neo-aramaic

lost lo: Kruh Bang in favor of lo1: Kru Bang for 1zxVrrsKu7KVO9hFhq7L in marma
lost lo: Krowk in favor of lo1: Krauk for CX6k68TA7ekrX7tCqmBV in marma
lost lo: Jijowa Peing in favor of lo1: Jijsawa Paing for DP1XGBs9Mgugsn6Hakuj in marma
lost lo: Kruchobare in favor of lo1: Kruchubare for FZd43jpcAJIjByETr6yx in marma
lost lo: Tohkrawk in favor of lo1: Tohkrauk for dA0fEDomVF3mrol6prA5 in marma
lost lo: Myok in favor of lo1: Myauk for pnrZ2tMU47LwtytrH35q in marma
lost lo: Chi in favor of lo1: Chi/Chuwit for xwYogvaoip58c4DLpKiA in marma

lost lo: kakhek in favor of lo1: kakʰek for 5I3V6b6WaQNqajA5RcWx in tutelo-saponi
