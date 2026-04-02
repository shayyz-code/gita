export type SourceType = 'youtube' | 'soundcloud' | 'local'

export type NavSection = 'browse' | 'playlists' | 'favourites' | 'settings'

export type Track = {
  id: string
  source: SourceType
  url: string
  title: string
  artist: string
  durationSec: number
  thumbnail?: string
  localObjectUrl?: string
}

export type Playlist = {
  id: string
  name: string
  trackIds: string[]
  pinned?: boolean
}

export type TrackLibrary = Record<string, Track>
