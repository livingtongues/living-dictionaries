export interface VideoCustomMetadata {
  uploadedByUid: string
  uploadedByName: string
  // deleted?: string; // Date.now().toString();
}

export interface HostedVideo {
  type: 'youtube' | 'vimeo'
  video_id: string
  start_at_seconds?: number
}
