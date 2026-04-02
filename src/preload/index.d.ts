import { ElectronAPI } from '@electron-toolkit/preload'

export type RpcStatus = {
  configured: boolean
  connected: boolean
  ready: boolean
  clientId: string
  socketPath?: string
  lastError?: string
}

export type RpcPresence = {
  details: string
  state?: string
  largeImageKey?: string
  largeImageText?: string
  smallImageKey?: string
  smallImageText?: string
  startTimestamp?: number
  endTimestamp?: number
}

export type MusicSource = 'youtube' | 'soundcloud'

export type MusicSearchResult = {
  id: string
  source: MusicSource
  url: string
  title: string
  artist: string
  durationSec: number
  thumbnail?: string
}

export type MusicPlaybackRequest = {
  source: MusicSource
  url: string
  seek?: number
}

export type MusicPlaybackResponse = {
  playbackUrl: string
}

export type CollectionTrack = {
  id: string
  source: 'youtube' | 'soundcloud' | 'local'
  url: string
  title: string
  artist: string
  durationSec: number
  thumbnail?: string
}

export type CollectionState = {
  playlists: Array<{ id: string; name: string; trackIds: string[]; pinned?: boolean }>
  favourites: string[]
  library: Record<string, CollectionTrack>
}

export type RendererApi = {
  rpcSetClientId: (clientId: string) => Promise<RpcStatus>
  rpcGetStatus: () => Promise<RpcStatus>
  rpcUpdatePresence: (payload: RpcPresence) => Promise<RpcStatus>
  rpcClearPresence: () => Promise<RpcStatus>
  musicSearch: (query: string) => Promise<MusicSearchResult[]>
  musicGetPlaybackUrl: (payload: MusicPlaybackRequest) => Promise<MusicPlaybackResponse>
  collectionsGetState: () => Promise<CollectionState>
  collectionsSetState: (payload: CollectionState) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApi
  }
}
