export interface IVideo {
  path: string; // Firebase Storage location
  ts?: any; // timestamp
  ab?: string; // added by uid
  sp?: string; // id of speaker
  vc?: string; // credit (e.g. institution, etc... someone or group in addition to the speaker)
  youtubeId?: string;
  vimeoId?: string;
}
