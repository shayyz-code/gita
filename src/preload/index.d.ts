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

export type RendererApi = {
  rpcSetClientId: (clientId: string) => Promise<RpcStatus>
  rpcGetStatus: () => Promise<RpcStatus>
  rpcUpdatePresence: (payload: RpcPresence) => Promise<RpcStatus>
  rpcClearPresence: () => Promise<RpcStatus>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApi
  }
}
