import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { DiscordRpcBridge, type RpcPresence } from './discordRpc'
import { MusicService, type PlaybackRequest } from './musicService'

const rpc = new DiscordRpcBridge()
const musicService = new MusicService()

function readClientIdFromDotEnv(): string {
  const envFiles = [join(process.cwd(), '.env.local'), join(process.cwd(), '.env')]

  for (const filePath of envFiles) {
    if (!existsSync(filePath)) {
      continue
    }

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const [rawKey, ...rawValueParts] = trimmed.split('=')
      if (!rawKey || rawValueParts.length === 0) {
        continue
      }

      const key = rawKey.trim()
      if (
        key !== 'DISCORD_CLIENT_ID' &&
        key !== 'MAIN_VITE_DISCORD_CLIENT_ID' &&
        key !== 'VITE_DISCORD_CLIENT_ID'
      ) {
        continue
      }

      const value = rawValueParts
        .join('=')
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (value) {
        return value
      }
    }
  }

  return ''
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1060,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gita.music')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('rpc:set-client-id', async (_, clientId: string) => {
    return rpc.setClientId(clientId)
  })

  ipcMain.handle('rpc:get-status', async () => {
    return rpc.probe()
  })

  ipcMain.handle('rpc:update-presence', async (_, payload: RpcPresence) => {
    await rpc.updatePresence(payload)
    return rpc.getStatus()
  })

  ipcMain.handle('rpc:clear-presence', async () => {
    await rpc.clearPresence()
    return rpc.getStatus()
  })

  ipcMain.handle('music:search', async (_, query: string) => {
    return musicService.search(query)
  })

  ipcMain.handle('music:get-playback-url', async (_, payload: PlaybackRequest) => {
    return musicService.getPlaybackUrl(payload)
  })

  const envClientId = (
    process.env.DISCORD_CLIENT_ID ||
    process.env.MAIN_VITE_DISCORD_CLIENT_ID ||
    process.env.VITE_DISCORD_CLIENT_ID ||
    readClientIdFromDotEnv() ||
    ''
  ).trim()
  if (envClientId) {
    void rpc.setClientId(envClientId)
  }
  void musicService.start()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  rpc.disconnect()
  void musicService.stop()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
