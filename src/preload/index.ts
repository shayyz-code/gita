import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type RpcStatus = {
  configured: boolean
  connected: boolean
  ready: boolean
  clientId: string
  socketPath?: string
  lastError?: string
}

type RpcPresence = {
  details: string
  state?: string
  largeImageKey?: string
  largeImageText?: string
  smallImageKey?: string
  smallImageText?: string
  startTimestamp?: number
  endTimestamp?: number
}

const api = {
  rpcSetClientId: (clientId: string): Promise<RpcStatus> =>
    ipcRenderer.invoke('rpc:set-client-id', clientId),
  rpcGetStatus: (): Promise<RpcStatus> => ipcRenderer.invoke('rpc:get-status'),
  rpcUpdatePresence: (payload: RpcPresence): Promise<RpcStatus> =>
    ipcRenderer.invoke('rpc:update-presence', payload),
  rpcClearPresence: (): Promise<RpcStatus> => ipcRenderer.invoke('rpc:clear-presence')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type { RpcPresence, RpcStatus }
