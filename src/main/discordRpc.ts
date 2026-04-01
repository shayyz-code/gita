import { randomUUID } from 'crypto'
import { Socket, createConnection } from 'net'
import { join } from 'path'

const RPC_VERSION = 1
const OPCODE_HANDSHAKE = 0
const OPCODE_FRAME = 1
const OPCODE_CLOSE = 2
const OPCODE_PING = 3
const OPCODE_PONG = 4

const DISCORD_SOCKETS = Array.from({ length: 10 }, (_, index) => [
  join(process.env.XDG_RUNTIME_DIR || '', `discord-ipc-${index}`),
  join(process.env.TMPDIR || '', `discord-ipc-${index}`),
  join('/tmp', `discord-ipc-${index}`)
]).flat()

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

type RpcStatus = {
  configured: boolean
  connected: boolean
  ready: boolean
  clientId: string
  socketPath?: string
  lastError?: string
}

type RpcFrame = {
  cmd?: string
  evt?: string
  nonce?: string
  data?: {
    code?: number
    message?: string
  }
}

type PendingResolver = {
  resolve: (value: RpcFrame) => void
  reject: (error: Error) => void
}

export class DiscordRpcBridge {
  private clientId = ''
  private socket: Socket | null = null
  private connected = false
  private ready = false
  private socketPath = ''
  private lastError = ''
  private readBuffer = Buffer.alloc(0)
  private pending = new Map<string, PendingResolver>()
  private frameListeners = new Set<(frame: RpcFrame) => void>()

  async setClientId(clientId: string): Promise<RpcStatus> {
    const normalized = clientId.trim()

    if (normalized === this.clientId) {
      return this.getStatus()
    }

    this.disconnect()
    this.clientId = normalized

    if (!this.clientId) {
      return this.getStatus()
    }

    await this.connect()
    return this.getStatus()
  }

  getStatus(): RpcStatus {
    return {
      configured: Boolean(this.clientId),
      connected: this.connected,
      ready: this.ready,
      clientId: this.clientId,
      socketPath: this.socketPath || undefined,
      lastError: this.lastError || undefined
    }
  }

  async probe(): Promise<RpcStatus> {
    if (this.clientId) {
      await this.ensureConnected()
    }

    return this.getStatus()
  }

  async clearPresence(): Promise<void> {
    if (!this.clientId) {
      return
    }

    const connected = await this.ensureConnected()
    if (!connected) {
      return
    }

    await this.sendRequest('SET_ACTIVITY', {
      pid: process.pid,
      activity: null
    })
  }

  async updatePresence(presence: RpcPresence): Promise<void> {
    if (!this.clientId) {
      return
    }

    const connected = await this.ensureConnected()
    if (!connected) {
      return
    }

    await this.sendRequest('SET_ACTIVITY', {
      pid: process.pid,
      activity: {
        details: presence.details,
        state: presence.state,
        assets: {
          large_image: presence.largeImageKey,
          large_text: presence.largeImageText,
          small_image: presence.smallImageKey,
          small_text: presence.smallImageText
        },
        timestamps: {
          start: presence.startTimestamp,
          end: presence.endTimestamp
        }
      }
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
    }

    this.socket = null
    this.connected = false
    this.ready = false
    this.socketPath = ''
    this.readBuffer = Buffer.alloc(0)

    this.flushPending(new Error('RPC disconnected'))
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.connected && this.ready) {
      return true
    }

    return this.connect()
  }

  private async connect(): Promise<boolean> {
    if (!this.clientId) {
      return false
    }

    for (const socketPath of DISCORD_SOCKETS) {
      if (!socketPath) {
        continue
      }

      const connected = await this.tryConnect(socketPath)
      if (connected) {
        this.lastError = ''
        return true
      }
    }

    this.connected = false
    this.ready = false
    this.socketPath = ''
    this.lastError = 'Could not connect to Discord IPC socket. Is Discord desktop running?'
    return false
  }

  private tryConnect(socketPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection(socketPath)
      let settled = false

      const fail = (message: string): void => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        socket.destroy()
        this.lastError = message
        resolve(false)
      }

      const onConnect = (): void => {
        this.socket = socket
        this.connected = true
        this.ready = false
        this.socketPath = socketPath
        this.readBuffer = Buffer.alloc(0)

        socket.on('error', (error) => {
          this.lastError = error.message
          this.connected = false
          this.ready = false
          this.socket = null
          this.socketPath = ''
          this.flushPending(error)
        })

        socket.on('close', () => {
          this.connected = false
          this.ready = false
          this.socket = null
          this.socketPath = ''
          this.flushPending(new Error('Discord RPC socket closed'))
        })

        socket.on('data', (chunk) => {
          this.handleData(chunk)
        })

        this.send(OPCODE_HANDSHAKE, {
          v: RPC_VERSION,
          client_id: this.clientId
        })
      }

      const onFrame = (frame: RpcFrame): void => {
        if (frame.evt === 'READY') {
          if (settled) {
            return
          }

          settled = true
          cleanup()
          this.ready = true
          this.lastError = ''
          resolve(true)
          return
        }

        if (frame.evt === 'ERROR') {
          const errorMessage = frame.data?.message || 'Discord RPC reported an error.'
          fail(errorMessage)
        }
      }

      const onFail = (): void => {
        fail('Could not open Discord IPC socket.')
      }

      const readyTimeout = setTimeout(() => {
        fail('Discord RPC handshake timed out.')
      }, 2500)

      const cleanup = (): void => {
        clearTimeout(readyTimeout)
        socket.removeListener('error', onFail)
        socket.removeListener('connect', onConnect)
        this.frameListeners.delete(onFrame)
      }

      socket.once('error', onFail)
      socket.once('connect', onConnect)
      this.frameListeners.add(onFrame)
    })
  }

  private handleData(chunk: Buffer): void {
    this.readBuffer = Buffer.concat([this.readBuffer, chunk])

    while (this.readBuffer.length >= 8) {
      const opcode = this.readBuffer.readInt32LE(0)
      const length = this.readBuffer.readInt32LE(4)

      if (this.readBuffer.length < 8 + length) {
        return
      }

      const body = this.readBuffer.subarray(8, 8 + length)
      this.readBuffer = this.readBuffer.subarray(8 + length)

      if (opcode === OPCODE_PING) {
        this.send(OPCODE_PONG, body.length ? JSON.parse(body.toString('utf8')) : {})
        continue
      }

      if (opcode === OPCODE_CLOSE) {
        this.lastError = 'Discord RPC closed the connection.'
        this.disconnect()
        continue
      }

      if (opcode !== OPCODE_FRAME) {
        continue
      }

      let frame: RpcFrame
      try {
        frame = JSON.parse(body.toString('utf8')) as RpcFrame
      } catch {
        continue
      }

      for (const listener of this.frameListeners) {
        listener(frame)
      }

      if (!frame.nonce) {
        continue
      }

      const resolver = this.pending.get(frame.nonce)
      if (!resolver) {
        continue
      }

      this.pending.delete(frame.nonce)
      if (frame.evt === 'ERROR') {
        resolver.reject(new Error(frame.data?.message || 'Discord RPC request failed'))
      } else {
        resolver.resolve(frame)
      }
    }
  }

  private async sendRequest(cmd: string, args: Record<string, unknown>): Promise<RpcFrame> {
    const nonce = randomUUID()

    return new Promise((resolve, reject) => {
      this.pending.set(nonce, { resolve, reject })

      this.send(OPCODE_FRAME, {
        cmd,
        args,
        nonce
      })

      setTimeout(() => {
        const stillPending = this.pending.get(nonce)
        if (!stillPending) {
          return
        }

        this.pending.delete(nonce)
        reject(new Error(`RPC request timed out for ${cmd}`))
      }, 2500)
    })
  }

  private flushPending(error: Error): void {
    for (const [nonce, handler] of this.pending.entries()) {
      this.pending.delete(nonce)
      handler.reject(error)
    }
  }

  private send(opcode: number, payload: unknown): void {
    if (!this.socket || !this.connected) {
      return
    }

    const data = Buffer.from(JSON.stringify(payload), 'utf8')
    const header = Buffer.alloc(8)

    header.writeInt32LE(opcode, 0)
    header.writeInt32LE(data.length, 4)

    this.socket.write(Buffer.concat([header, data]))
  }
}

export type { RpcPresence, RpcStatus }
