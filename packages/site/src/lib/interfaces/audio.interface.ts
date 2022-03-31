export interface IAudio {
    path: string; // Firebase Storage location
    // mt: string; // deprecated after updating storage security rules // media-token, add onto end of URL + path // WAS url
    ts?: any; // timestamp // WAS uploadedAt
    ab?: string; // added by uid // WAS uploadedBy
    sp?: string; // id of speaker
    playing?: boolean; // turned true when audio is being played
    sc?: string; // source
    source?: string; // deprecated

    // for old Talking Dictionaries
    speakerName?: string;
    previousFileName?: string; // deprecated, put into metadata instead
}

// size?: number; // deprecating, it's in the metadata
