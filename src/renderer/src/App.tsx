import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'

type SourceType = 'youtube' | 'soundcloud' | 'local'

type Track = {
  id: string
  title: string
  artist: string
  source: SourceType
  url: string
  localObjectUrl?: string
}

const starterTracks: Track[] = [
  {
    id: crypto.randomUUID(),
    title: 'lofi hip hop radio',
    artist: 'Lofi Girl',
    source: 'youtube',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
  },
  {
    id: crypto.randomUUID(),
    title: 'On Hold',
    artist: 'The xx',
    source: 'soundcloud',
    url: 'https://soundcloud.com/thexx/on-hold'
  }
]

const sourceLabel: Record<SourceType, string> = {
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  local: 'Local'
}

const SOURCE_STYLES: Record<SourceType, string> = {
  youtube: 'source-chip source-chip-youtube',
  soundcloud: 'source-chip source-chip-soundcloud',
  local: 'source-chip source-chip-local'
}

const envDiscordClientId = (import.meta.env.VITE_DISCORD_CLIENT_ID || '').trim()

function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim()

  const directMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (directMatch) {
    return directMatch[1]
  }

  const embedMatch = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)
  if (embedMatch) {
    return embedMatch[1]
  }

  return null
}

function detectSource(url: string): SourceType | null {
  const lower = url.toLowerCase()

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube'
  }

  if (lower.includes('soundcloud.com')) {
    return 'soundcloud'
  }

  return null
}

function buildYoutubeEmbed(url: string, autoplay: boolean): string | null {
  const videoId = extractYoutubeId(url)
  if (!videoId) {
    return null
  }

  return `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&playsinline=1&rel=0`
}

function buildSoundcloudEmbed(url: string, autoplay: boolean): string {
  const encoded = encodeURIComponent(url)
  return `https://w.soundcloud.com/player/?url=${encoded}&auto_play=${autoplay ? 'true' : 'false'}&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true`
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }

  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function toPresenceText(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  return trimmed.slice(0, 128)
}

function toRpcStatusText(status: {
  configured: boolean
  connected: boolean
  ready: boolean
  lastError?: string
}): string {
  if (!status.configured) {
    return 'Discord RPC not configured'
  }

  if (status.connected && status.ready) {
    return 'Discord RPC connected'
  }

  if (status.lastError) {
    return `Discord RPC error: ${status.lastError}`
  }

  return 'Discord RPC configured. Launch Discord desktop to connect.'
}

function App(): React.JSX.Element {
  const [tracks, setTracks] = useState<Track[]>(starterTracks)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [titleInput, setTitleInput] = useState('')
  const [artistInput, setArtistInput] = useState('')
  const [message, setMessage] = useState('Streaming from YouTube, SoundCloud, and local files.')
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [embedRefreshNonce, setEmbedRefreshNonce] = useState(0)
  const [rpcClientId, setRpcClientId] = useState(
    () => envDiscordClientId || localStorage.getItem('gita.discordClientId') || ''
  )
  const [rpcStatusText, setRpcStatusText] = useState('Discord RPC not configured')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tracksRef = useRef<Track[]>(starterTracks)
  const initialRpcClientIdRef = useRef(rpcClientId)

  const currentTrack = tracks[currentIndex] ?? null

  const embedUrl = useMemo(() => {
    if (!currentTrack) {
      return null
    }

    if (currentTrack.source === 'youtube') {
      return buildYoutubeEmbed(currentTrack.url, isPlaying)
    }

    if (currentTrack.source === 'soundcloud') {
      return buildSoundcloudEmbed(currentTrack.url, isPlaying)
    }

    return null
  }, [currentTrack, embedRefreshNonce, isPlaying])

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  const supportsNativeControls = currentTrack?.source === 'local'

  useEffect(() => {
    if (!currentTrack || currentTrack.source !== 'local' || !audioRef.current) {
      return
    }

    if (isPlaying) {
      void audioRef.current.play()
    } else {
      audioRef.current.pause()
    }
  }, [currentTrack, isPlaying])

  useEffect(() => {
    const initialRpcClientId = initialRpcClientIdRef.current
    if (!initialRpcClientId.trim()) {
      return
    }

    void window.api
      .rpcSetClientId(initialRpcClientId)
      .then((status) => {
        setRpcStatusText(toRpcStatusText(status))
      })
      .catch((error: Error) => {
        setRpcStatusText(`Discord RPC error: ${error.message}`)
      })
  }, [])

  useEffect(() => {
    const tick = (): void => {
      void window.api
        .rpcGetStatus()
        .then((status) => {
          setRpcStatusText(toRpcStatusText(status))
        })
        .catch((error: Error) => {
          setRpcStatusText(`Discord RPC error: ${error.message}`)
        })
    }

    tick()
    const intervalId = window.setInterval(tick, 3500)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const activateTrack = (nextIndex: number): void => {
    setCurrentIndex(nextIndex)
    setProgressSeconds(0)
    setDurationSeconds(0)
    setIsPlaying(true)
  }

  useEffect(() => {
    if (!currentTrack) {
      void window.api.rpcClearPresence()
      return
    }

    const details = toPresenceText(currentTrack.title, 'Unknown Track')
    const state = toPresenceText(
      `${currentTrack.artist} • ${sourceLabel[currentTrack.source]}`,
      'Listening'
    )

    let startTimestamp: number | undefined
    let endTimestamp: number | undefined
    if (isPlaying && durationSeconds > 0) {
      startTimestamp = Math.floor(Date.now() / 1000) - Math.floor(progressSeconds)
      endTimestamp = startTimestamp + Math.floor(durationSeconds)
    }

    void window.api
      .rpcUpdatePresence({
        details,
        state,
        largeImageText: `${sourceLabel[currentTrack.source]} • ${currentTrack.artist}`,
        smallImageText: isPlaying ? 'Playing' : 'Paused',
        startTimestamp,
        endTimestamp
      })
      .catch((error: Error) => {
        setRpcStatusText(`Discord RPC error: ${error.message}`)
      })
  }, [currentTrack, durationSeconds, isPlaying, progressSeconds])

  useEffect(() => {
    return () => {
      tracksRef.current.forEach((track) => {
        if (track.localObjectUrl) {
          URL.revokeObjectURL(track.localObjectUrl)
        }
      })

      void window.api.rpcClearPresence()
    }
  }, [])

  const addStream = (): void => {
    const cleanedUrl = urlInput.trim()
    if (!cleanedUrl) {
      setMessage('Paste a YouTube or SoundCloud URL first.')
      return
    }

    const source = detectSource(cleanedUrl)
    if (!source) {
      setMessage('Only YouTube and SoundCloud links are supported for URL streaming.')
      return
    }

    if (source === 'youtube' && !extractYoutubeId(cleanedUrl)) {
      setMessage('That YouTube URL format is not supported. Use a standard watch/share URL.')
      return
    }

    const newTrack: Track = {
      id: crypto.randomUUID(),
      title: titleInput.trim() || `${sourceLabel[source]} Stream`,
      artist: artistInput.trim() || 'Unknown Artist',
      source,
      url: cleanedUrl
    }

    const nextIndex = tracks.length
    setTracks((prev) => [...prev, newTrack])
    activateTrack(nextIndex)
    setUrlInput('')
    setTitleInput('')
    setArtistInput('')
    setMessage(`${sourceLabel[source]} stream added to queue.`)
  }

  const addLocalFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      return
    }

    const newTracks: Track[] = files.map((file) => {
      const objectUrl = URL.createObjectURL(file)

      return {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[a-zA-Z0-9]+$/, ''),
        artist: 'Local Library',
        source: 'local',
        url: objectUrl,
        localObjectUrl: objectUrl
      }
    })

    const startIndex = tracks.length
    setTracks((prev) => [...prev, ...newTracks])
    activateTrack(startIndex)
    setMessage(`${newTracks.length} local track${newTracks.length > 1 ? 's' : ''} added.`)
    event.target.value = ''
  }

  const togglePlayback = (): void => {
    if (!currentTrack) {
      return
    }

    if (currentTrack.source === 'local') {
      setIsPlaying((prev) => !prev)
      return
    }

    setIsPlaying(true)
    setEmbedRefreshNonce((prev) => prev + 1)
    setMessage(
      'YouTube and SoundCloud run inside embeds. Use controls in the player frame for pause/seek.'
    )
  }

  const goNext = (): void => {
    if (!tracks.length) {
      return
    }

    activateTrack((currentIndex + 1) % tracks.length)
  }

  const goPrev = (): void => {
    if (!tracks.length) {
      return
    }

    activateTrack((currentIndex - 1 + tracks.length) % tracks.length)
  }

  const seekLocalTrack = (nextValue: number): void => {
    if (currentTrack?.source === 'local' && audioRef.current) {
      audioRef.current.currentTime = nextValue
    }
    setProgressSeconds(nextValue)
  }

  const saveDiscordClientId = (): void => {
    localStorage.setItem('gita.discordClientId', rpcClientId)

    void window.api
      .rpcSetClientId(rpcClientId)
      .then((status) => {
        setRpcStatusText(toRpcStatusText(status))
        setMessage('Discord RPC client ID saved.')
      })
      .catch((error: Error) => {
        setRpcStatusText(`Discord RPC error: ${error.message}`)
      })
  }

  const sendTestRpc = (): void => {
    if (!rpcClientId.trim()) {
      setMessage('Enter your Discord Client ID first, then click Save RPC Client ID.')
      return
    }

    const now = Math.floor(Date.now() / 1000)

    void window.api
      .rpcSetClientId(rpcClientId)
      .then((status) => {
        setRpcStatusText(toRpcStatusText(status))
        return window.api.rpcUpdatePresence({
          details: 'Gita RPC Test',
          state: 'If you see this, Discord RPC works',
          smallImageText: 'Testing',
          startTimestamp: now
        })
      })
      .then((status) => {
        setRpcStatusText(toRpcStatusText(status))
        setMessage('Test RPC presence sent. Check your Discord profile now.')
      })
      .catch((error: Error) => {
        setRpcStatusText(`Discord RPC error: ${error.message}`)
      })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Gita</h1>
        <p className="sidebar-subtitle">Apple Music-inspired streaming</p>

        <div className="panel">
          <h2>Add Stream URL</h2>
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="YouTube or SoundCloud URL"
          />
          <input
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Track title (optional)"
          />
          <input
            value={artistInput}
            onChange={(event) => setArtistInput(event.target.value)}
            placeholder="Artist (optional)"
          />
          <button onClick={addStream}>Add Stream</button>
        </div>

        <div className="panel">
          <h2>Add Local Files</h2>
          <label className="upload">
            Import audio
            <input type="file" accept="audio/*" multiple onChange={addLocalFiles} />
          </label>
        </div>

        <div className="panel">
          <h2>Discord RPC</h2>
          <input
            value={rpcClientId}
            onChange={(event) => setRpcClientId(event.target.value)}
            placeholder="Discord Client ID (env: DISCORD_CLIENT_ID / MAIN_VITE_DISCORD_CLIENT_ID)"
          />
          <button onClick={saveDiscordClientId}>Save RPC Client ID</button>
          <button onClick={sendTestRpc}>Test RPC</button>
          <p className="rpc-status">{rpcStatusText}</p>
        </div>
      </aside>

      <main className="main-content">
        <section className="hero">
          <div className="cover-art">{currentTrack?.title.slice(0, 1).toUpperCase() || 'G'}</div>
          <div>
            <p className="eyebrow">Now Playing</p>
            <h2>{currentTrack?.title || 'No track selected'}</h2>
            <p className="artist-line">{currentTrack?.artist || 'Select a track from queue'}</p>
            <p className={currentTrack ? SOURCE_STYLES[currentTrack.source] : 'source-chip'}>
              {currentTrack ? sourceLabel[currentTrack.source] : 'No Source'}
            </p>
          </div>
        </section>

        <section className="player-card">
          <div className="transport">
            <button onClick={goPrev}>Prev</button>
            <button onClick={togglePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button onClick={goNext}>Next</button>
          </div>

          <div className="progress-wrap">
            <span>{formatTime(progressSeconds)}</span>
            <input
              type="range"
              min={0}
              max={durationSeconds || 0}
              step={1}
              disabled={!supportsNativeControls || !durationSeconds}
              value={Math.min(progressSeconds, durationSeconds || 0)}
              onChange={(event) => seekLocalTrack(Number(event.target.value))}
            />
            <span>{formatTime(durationSeconds)}</span>
          </div>

          <p className="hint">
            {supportsNativeControls
              ? 'Transport controls are fully synced for local playback.'
              : 'For YouTube/SoundCloud, use controls inside the embedded player.'}
          </p>

          {currentTrack?.source === 'local' && (
            <audio
              ref={audioRef}
              src={currentTrack.url}
              onLoadedMetadata={(event) => setDurationSeconds(event.currentTarget.duration)}
              onTimeUpdate={(event) => setProgressSeconds(event.currentTarget.currentTime)}
              onEnded={goNext}
            />
          )}

          {currentTrack && currentTrack.source !== 'local' && embedUrl && (
            <iframe
              key={`${currentTrack.id}-${embedRefreshNonce}-${isPlaying ? 'play' : 'pause'}`}
              className="embed-player"
              src={embedUrl}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={`${currentTrack.title} player`}
            />
          )}
        </section>
      </main>

      <aside className="queue-panel">
        <h2>Queue</h2>
        <p className="status-message">{message}</p>
        <ul>
          {tracks.map((track, index) => (
            <li
              key={track.id}
              className={index === currentIndex ? 'queue-item active' : 'queue-item'}
              onClick={() => activateTrack(index)}
            >
              <div>
                <p className="queue-title">{track.title}</p>
                <p className="queue-artist">{track.artist}</p>
              </div>
              <span className={SOURCE_STYLES[track.source]}>{sourceLabel[track.source]}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

export default App
