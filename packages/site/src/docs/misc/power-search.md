# Power Search

There are a few features in the pipeline and a few pain points that would all be solved by a better search system:
- API
- No advanced search ability with Algolia, for example, search just the start or end of lexemes, search for minimal pairs, use wildcards, etc... (phoneme analysis features, etc...)
- Sort by any field
- Offline search (and usage), server-side search

Three possible solutions would be:

## 1
- Index all dictionaries up-front (and when adding features like a "hasAudio" flag)
- Update the current indexing function that listens to document writes to download the proper csv for that dictionary, update the row by entry id and then save the csv back to the cloud
- Con: Race conditions, possible to get around this by writing each value to a KV store and then updating the overall CSV from there - sounds over-engineered

## 2
- Run a persistent server (App Engine or other?) with firebase client SDK (firebase-admin doesn't cache reads) running that is subscribed to each dictionary's words collection and on changes, writes over the cloud csv for that dictionary.
- Con: this sounds fraught with the chance that Firebase on that server will crash as the client SDK wasn't built to be subscribed to 150K documents at once nor do I trust it's cache to be 100% reliable at that scale.

## 3
- Load collection of entries from Firestore, but perform searching in worker thread to avoid jank we previously experienced using this method.
- If the collection is to heavy, then create a parallel collection in Firestore that's lighter weight w/o data not needed for search - this will nix the ability to do offline edits so perhaps not so good - perhaps another solution if entries are too heavy is to pull out some data from the main entry body into sub documents if just needed for the entry view as a manager sees it, not for first load.
- Con: must wait for all entries to come down from Firestore before allowing search (just on the first time through as they will be cached after that), this can be mitigated by having a dictionary landing page which loads entries in the background. Another possible con is costs, for every 5,000 new browsers searching entries from a dictionary averaging 2,000 entries in size, that will cost us $6. $6 per 5,000 new dictionary visits (not return visitors) isn't so bad. Also because of the free tier we get the first 25 visits/day for free, adding up to 750 free new visitors a month. (Based on $0.06/100,000 reads = $6 per 10 million reads)