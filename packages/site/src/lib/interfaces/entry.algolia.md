id > objectID
dictId: ADD if not already present (may be in some entries)

pf.hasImage = true if image
pf: ts needs converted to a usable timestamp
keep pf.gcs but remove other pf properties

sf.hasAudio = true if audio
sf.speakerName - pull from speakerId on import to Algolia 
sf.noSpeakerName = true if none but has audio
sf.ts: needs converted to usable timestamp
sf.path: keep
remove other sf properites

convert ub & ab from Firestore timestamp (if it is) into 10 digit Unix date timestamps in number format like: 1580860855
    ts._seconds: "1580860855"
    ts._nanoseconds: 305000000

ps: will need facet/refinement value display based on language
sdn: will need facet/refinement value display based on language
ei: add replica index for Onondaga to sort by elicitation id
