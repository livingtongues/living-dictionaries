export interface IVideo {
  //TODO not ready, need to understand needed YouTube parameters
  path: string; // storage: it could be internal -firebase- or an external link
  ts?: any; // timestamp // WAS uploadedAt
  ab?: string; // added by uid // WAS uploadedBy
  sp?: string; // id of the speaker in the video
  vc?: string; //video credit. If the path is external, this will be filled instead of sp
  externalId?: string; // external video ID
  playing?: boolean; // turned true when video is being played
}
