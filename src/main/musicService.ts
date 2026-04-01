import { spawn } from 'child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { URL } from 'url'
import * as play from 'play-dl'

type MusicSource = 'youtube' | 'soundcloud'

type SearchResult = {
  id: string
  source: MusicSource
  url: string
  title: string
  artist: string
  durationSec: number
  thumbnail?: string
}

type PlaybackRequest = {
  source: MusicSource
  url: string
  seek?: number
}

type PlaybackResponse = {
  playbackUrl: string
}

const STREAM_MIME_BY_TYPE: Record<string, string> = {
  'webm/opus': 'audio/webm',
  'ogg/opus': 'audio/ogg',
  opus: 'audio/ogg',
  raw: 'audio/mpeg',
  arbitrary: 'audio/mpeg'
}

export class MusicService {
  private server = createServer()
  private port = 0
  private soundCloudReady = false
  private soundCloudClientId = ''

  async start(): Promise<void> {
    if (this.port > 0) {
      return
    }

    this.server.removeAllListeners('request')
    this.server.on('request', this.handleHttpRequest)

    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        this.server.removeListener('error', reject)
        const address = this.server.address() as AddressInfo | null
        if (!address) {
          reject(new Error('Could not bind local music stream server.'))
          return
        }

        this.port = address.port
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (this.port === 0) {
      return
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.port = 0
        resolve()
      })
    })
  }

  async search(query: string): Promise<SearchResult[]> {
    const cleanedQuery = query.trim()
    if (!cleanedQuery) {
      return []
    }

    const [youtubeResult, soundcloudResult] = await Promise.allSettled([
      this.searchYoutube(cleanedQuery),
      this.searchSoundCloud(cleanedQuery)
    ])

    const youtube = youtubeResult.status === 'fulfilled' ? youtubeResult.value : []
    const soundcloud = soundcloudResult.status === 'fulfilled' ? soundcloudResult.value : []

    return [...youtube, ...soundcloud]
  }

  async getPlaybackUrl(request: PlaybackRequest): Promise<PlaybackResponse> {
    if (!this.port) {
      await this.start()
    }

    const seek = Math.max(0, Math.floor(request.seek || 0))
    const params = new URLSearchParams({
      source: request.source,
      url: request.url,
      seek: String(seek),
      t: String(Date.now())
    })

    return {
      playbackUrl: `http://127.0.0.1:${this.port}/stream?${params.toString()}`
    }
  }

  private readonly handleHttpRequest = async (
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> => {
    try {
      if (!request.url) {
        response.writeHead(400)
        response.end('Missing URL')
        return
      }

      const parsed = new URL(request.url, 'http://127.0.0.1')
      if (parsed.pathname !== '/stream') {
        response.writeHead(404)
        response.end('Not found')
        return
      }

      const source = parsed.searchParams.get('source')
      const url = parsed.searchParams.get('url')
      const seek = Number(parsed.searchParams.get('seek') || 0)

      if (!url || (source !== 'youtube' && source !== 'soundcloud')) {
        response.writeHead(400)
        response.end('Invalid stream request')
        return
      }

      if (source === 'youtube') {
        this.handleYoutubeProxy(url, response, request)
        return
      }

      await this.ensureSoundCloudToken()

      const streamResult = await play.stream(url, {
        seek: Number.isFinite(seek) ? Math.max(0, seek) : 0,
        quality: 2,
        discordPlayerCompatibility: true
      })

      const streamType = String(streamResult.type)
      const mimeType = STREAM_MIME_BY_TYPE[streamType] || 'audio/mpeg'

      response.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store',
        Connection: 'keep-alive'
      })

      streamResult.stream.on('error', () => {
        if (!response.headersSent) {
          response.writeHead(500)
        }
        response.end()
      })

      request.on('close', () => {
        streamResult.stream.destroy()
      })

      streamResult.stream.pipe(response)
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(500)
      }

      const message = error instanceof Error ? error.message : 'Unknown stream error'
      response.end(message)
    }
  }

  private handleYoutubeProxy(url: string, response: ServerResponse, request: IncomingMessage): void {
    const args = ['-f', 'bestaudio[ext=m4a]/bestaudio', '--no-playlist', '-o', '-', url]
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderrTail = ''
    let sentAudioHeaders = false

    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-600)
    })

    child.stdout.on('data', (chunk: Buffer) => {
      if (!sentAudioHeaders) {
        response.writeHead(200, {
          'Content-Type': 'audio/mp4',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive'
        })
        sentAudioHeaders = true
      }

      response.write(chunk)
    })

    child.stdout.once('end', () => {
      if (!response.writableEnded) {
        response.end()
      }
    })

    child.once('error', (error) => {
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end(`yt-dlp failed to start: ${error.message}`)
        return
      }

      if (!response.writableEnded) {
        response.end()
      }
    })

    child.once('close', (code) => {
      if (!response.headersSent && code !== 0) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end(`yt-dlp failed (exit ${String(code)}): ${stderrTail || 'Unknown error'}`)
        return
      }

      if (!response.writableEnded) {
        response.end()
      }
    })

    request.on('close', () => {
      child.kill('SIGTERM')
    })
  }

  private async searchYoutube(query: string): Promise<SearchResult[]> {
    try {
      const results = await play.search(query, {
        source: {
          youtube: 'video'
        },
        limit: 8
      })

      return results
        .filter((item) => item.url)
        .map((item) => ({
          id: `yt:${item.id || item.url}`,
          source: 'youtube',
          url: item.url,
          title: item.title || 'Unknown Title',
          artist: item.channel?.name || 'YouTube',
          durationSec: item.durationInSec || 0,
          thumbnail: item.thumbnails?.[0]?.url
        }))
    } catch {
      // play-dl can intermittently fail when YouTube response shapes change.
      // Fallback to yt-dlp search so the app remains usable.
      return this.searchYoutubeViaYtDlp(query)
    }
  }

  private async searchSoundCloud(query: string): Promise<SearchResult[]> {
    try {
      await this.ensureSoundCloudToken()

      const results = await play.search(query, {
        source: {
          soundcloud: 'tracks'
        },
        limit: 8
      })

      return results
        .filter((item) => item.url)
        .map((item) => ({
          id: `sc:${item.id || item.url}`,
          source: 'soundcloud',
          url: item.url,
          title: item.name || 'Unknown Title',
          artist: item.user?.name || 'SoundCloud',
          durationSec: item.durationInSec || 0,
          thumbnail: item.thumbnail
        }))
    } catch {
      return []
    }
  }

  private async ensureSoundCloudToken(): Promise<void> {
    if (this.soundCloudReady) {
      return
    }

    if (!this.soundCloudClientId) {
      this.soundCloudClientId = await play.getFreeClientID()
    }

    await play.setToken({
      soundcloud: {
        client_id: this.soundCloudClientId
      }
    })

    this.soundCloudReady = true
  }

  private async searchYoutubeViaYtDlp(query: string): Promise<SearchResult[]> {
    return new Promise<SearchResult[]>((resolve) => {
      const child = spawn('yt-dlp', ['--dump-single-json', '--no-warnings', 'ytsearch8:' + query], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })

      child.once('error', () => {
        resolve([])
      })

      child.once('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          resolve([])
          return
        }

        try {
          const payload = JSON.parse(stdout) as {
            entries?: Array<{
              id?: string
              title?: string
              duration?: number
              uploader?: string
              channel?: string
              webpage_url?: string
              url?: string
              thumbnail?: string
            }>
          }
          const entries = payload.entries || []

          const mapped: SearchResult[] = []
          for (const entry of entries) {
            const videoUrl = entry.webpage_url || entry.url
            if (!videoUrl) {
              continue
            }

            mapped.push({
              id: `yt:${entry.id || videoUrl}`,
              source: 'youtube',
              url: videoUrl,
              title: entry.title || 'Unknown Title',
              artist: entry.uploader || entry.channel || 'YouTube',
              durationSec: Number.isFinite(entry.duration) ? Math.max(0, Math.floor(entry.duration || 0)) : 0,
              thumbnail: entry.thumbnail
            })
          }

          resolve(mapped)
        } catch {
          resolve([])
        }
      })
    })
  }
}

export type { MusicSource, PlaybackRequest, PlaybackResponse, SearchResult }
