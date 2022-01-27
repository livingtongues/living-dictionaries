export interface IVideo {
  path: string; // storage: it could be internal -firebase- or an external link
  ts?: any; // timestamp // WAS uploadedAt
  ab?: string; // added by uid // WAS uploadedBy
  vsp?: string; // id of the video speaker. It works the same way as an audio speaker (sp) but this way is easier to differentiate it from the audio speaker for further filter options
  vc?: string; //video credit. If the path is external, this will be filled instead of sp
  externalId?: string; // external video ID
  playing?: boolean; // turned true when video is being played
}
