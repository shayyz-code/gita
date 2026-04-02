import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'

type SourceType = 'youtube' | 'soundcloud' | 'local'
type NavSection = 'browse' | 'playlists' | 'favourites' | 'settings'

type Track = {
  id: string
  source: SourceType
  url: string
  title: string
  artist: string
  durationSec: number
  thumbnail?: string
  localObjectUrl?: string
}

type Playlist = {
  id: string
  name: string
  trackIds: string[]
}

type TrackLibrary = Record<string, Track>

const PLAYLISTS_STORAGE_KEY = 'gita.playlists.v1'
const FAVOURITES_STORAGE_KEY = 'gita.favourites.v1'
const LIBRARY_STORAGE_KEY = 'gita.trackLibrary.v1'

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

const NAV_ITEMS: Array<{ id: NavSection; label: string }> = [
  { id: 'browse', label: 'Browse' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'settings', label: 'Settings' }
]

const envDiscordClientId = (import.meta.env.VITE_DISCORD_CLIENT_ID || '').trim()

function parseStorageJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
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
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudioSrc, setCurrentAudioSrc] = useState('')
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [message, setMessage] = useState('Search for songs and add them to queue.')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [activeNav, setActiveNav] = useState<NavSection>('browse')
  const [playlistDraftName, setPlaylistDraftName] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    parseStorageJson<Playlist[]>(localStorage.getItem(PLAYLISTS_STORAGE_KEY), [])
  )
  const [favouriteTrackIds, setFavouriteTrackIds] = useState<string[]>(() =>
    parseStorageJson<string[]>(localStorage.getItem(FAVOURITES_STORAGE_KEY), [])
  )
  const [trackLibrary, setTrackLibrary] = useState<TrackLibrary>(() =>
    parseStorageJson<TrackLibrary>(localStorage.getItem(LIBRARY_STORAGE_KEY), {})
  )

  const [rpcClientId, setRpcClientId] = useState(
    () => envDiscordClientId || localStorage.getItem('gita.discordClientId') || ''
  )
  const [rpcStatusText, setRpcStatusText] = useState('Discord RPC not configured')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackIdRef = useRef<string>('')
  const retryByTrackRef = useRef<Record<string, number>>({})
  const initialRpcClientIdRef = useRef(rpcClientId)
  const tracksRef = useRef<Track[]>([])

  const currentTrack = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null
  const canSeek = currentTrack?.source === 'local'
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null
  const favouriteTracks = favouriteTrackIds
    .map((trackId) => resolveTrackById(trackId))
    .filter((track): track is Track => Boolean(track))
  const selectedPlaylistTracks = selectedPlaylist
    ? selectedPlaylist.trackIds
        .map((trackId) => resolveTrackById(trackId))
        .filter((track): track is Track => Boolean(track))
    : []

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists))
  }, [playlists])

  useEffect(() => {
    localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favouriteTrackIds))
  }, [favouriteTrackIds])

  useEffect(() => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(trackLibrary))
  }, [trackLibrary])

  useEffect(() => {
    if (!playlists.length) {
      setSelectedPlaylistId('')
      return
    }

    const selectedExists = playlists.some((playlist) => playlist.id === selectedPlaylistId)
    if (!selectedExists) {
      setSelectedPlaylistId(playlists[0].id)
    }
  }, [playlists, selectedPlaylistId])

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
    if (!audioRef.current || !currentTrack) {
      return
    }

    if (isPlaying) {
      void audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audioRef.current.pause()
    }
  }, [currentAudioSrc, currentTrack, isPlaying])

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

  const loadTrackAudio = async (track: Track, seek = 0): Promise<void> => {
    currentTrackIdRef.current = track.id

    if (track.source === 'local') {
      setCurrentAudioSrc(track.url)
      setDurationSeconds(track.durationSec || 0)
      if (seek > 0 && audioRef.current) {
        audioRef.current.currentTime = seek
      }
      return
    }

    const playback = await window.api.musicGetPlaybackUrl({
      source: track.source,
      url: track.url,
      seek
    })

    if (currentTrackIdRef.current !== track.id) {
      return
    }

    setCurrentAudioSrc(playback.playbackUrl)
    setDurationSeconds(track.durationSec || 0)
  }

  const activateTrack = (nextIndex: number): void => {
    const selectedTrack = tracks[nextIndex]
    if (!selectedTrack) {
      return
    }

    retryByTrackRef.current[selectedTrack.id] = 0
    setCurrentIndex(nextIndex)
    setProgressSeconds(0)
    setDurationSeconds(selectedTrack.durationSec || 0)
    setIsPlaying(true)

    void loadTrackAudio(selectedTrack).catch((error: Error) => {
      setMessage(`Failed to load track: ${error.message}`)
      setIsPlaying(false)
    })
  }

  const onSearch = (): void => {
    const query = searchQuery.trim()
    if (!query) {
      return
    }

    setSearching(true)
    setMessage(`Searching for "${query}"...`)

    void window.api
      .musicSearch(query)
      .then((results) => {
        const mapped: Track[] = results.map((item) => ({
          id: item.id,
          source: item.source,
          url: item.url,
          title: item.title,
          artist: item.artist,
          durationSec: item.durationSec,
          thumbnail: item.thumbnail
        }))

        setSearchResults(mapped)
        setMessage(mapped.length ? `Found ${mapped.length} results.` : 'No tracks found.')
      })
      .catch((error: Error) => {
        setMessage(`Search failed: ${error.message}`)
      })
      .finally(() => {
        setSearching(false)
      })
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  const canPersistTrack = (track: Track): boolean => {
    return track.source !== 'local' && Boolean(track.url)
  }

  const registerTrackInLibrary = (track: Track): void => {
    if (!canPersistTrack(track)) {
      return
    }

    setTrackLibrary((prev) => {
      const existing = prev[track.id]
      if (existing) {
        return prev
      }

      return {
        ...prev,
        [track.id]: {
          id: track.id,
          source: track.source,
          url: track.url,
          title: track.title,
          artist: track.artist,
          durationSec: track.durationSec,
          thumbnail: track.thumbnail
        }
      }
    })
  }

  const isFavourite = (trackId: string): boolean => {
    return favouriteTrackIds.includes(trackId)
  }

  const addTrackToQueue = (track: Track, playNow: boolean): void => {
    registerTrackInLibrary(track)

    setTracks((prev) => {
      const exists = prev.some((item) => item.id === track.id)
      if (exists) {
        const existingIndex = prev.findIndex((item) => item.id === track.id)
        if (playNow && existingIndex >= 0) {
          window.setTimeout(() => activateTrack(existingIndex), 0)
        }

        return prev
      }

      const next = [...prev, track]
      const nextIndex = next.length - 1
      if (playNow) {
        window.setTimeout(() => activateTrack(nextIndex), 0)
      }

      return next
    })

    setMessage(playNow ? `${track.title} added and playing.` : `${track.title} added to queue.`)
  }

  const toggleFavouriteTrack = (track: Track): void => {
    if (!canPersistTrack(track)) {
      setMessage('Only YouTube and SoundCloud tracks can be saved to favourites.')
      return
    }

    registerTrackInLibrary(track)

    setFavouriteTrackIds((prev) => {
      const exists = prev.includes(track.id)
      const next = exists ? prev.filter((id) => id !== track.id) : [...prev, track.id]
      setMessage(exists ? `${track.title} removed from favourites.` : `${track.title} added to favourites.`)
      return next
    })
  }

  const createPlaylist = (): void => {
    const name = playlistDraftName.trim()
    if (!name) {
      setMessage('Enter a playlist name first.')
      return
    }

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name,
      trackIds: []
    }

    setPlaylists((prev) => [playlist, ...prev])
    setSelectedPlaylistId(playlist.id)
    setPlaylistDraftName('')
    setMessage(`Playlist "${playlist.name}" created.`)
  }

  const deletePlaylist = (playlistId: string): void => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId))
    setMessage('Playlist deleted.')
  }

  const addTrackToPlaylist = (playlistId: string, track: Track): void => {
    if (!playlistId) {
      setMessage('Select or create a playlist first.')
      return
    }

    if (!canPersistTrack(track)) {
      setMessage('Only YouTube and SoundCloud tracks can be saved in playlists.')
      return
    }

    registerTrackInLibrary(track)

    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist
        }

        if (playlist.trackIds.includes(track.id)) {
          return playlist
        }

        return {
          ...playlist,
          trackIds: [...playlist.trackIds, track.id]
        }
      })
    )
    setMessage(`Added "${track.title}" to playlist.`)
  }

  const removeTrackFromPlaylist = (playlistId: string, trackId: string): void => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist
        }

        return {
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => id !== trackId)
        }
      })
    )
    setMessage('Track removed from playlist.')
  }

  function resolveTrackById(trackId: string): Track | null {
    const fromQueue = tracks.find((track) => track.id === trackId)
    if (fromQueue) {
      return fromQueue
    }

    const fromSearch = searchResults.find((track) => track.id === trackId)
    if (fromSearch) {
      return fromSearch
    }

    return trackLibrary[trackId] || null
  }

  const tryRecoverRemoteStream = (reason: string): void => {
    if (!currentTrack || currentTrack.source === 'local') {
      return
    }

    const retries = retryByTrackRef.current[currentTrack.id] || 0
    if (retries >= 1) {
      setMessage(`Playback interrupted (${reason}). Try replaying the track.`)
      setIsPlaying(false)
      return
    }

    retryByTrackRef.current[currentTrack.id] = retries + 1
    const seek = Math.max(0, Math.floor(audioRef.current?.currentTime || progressSeconds || 0))
    setMessage(`Reconnecting stream for "${currentTrack.title}"...`)

    void loadTrackAudio(currentTrack, seek)
      .then(() => {
        setIsPlaying(true)
        setMessage(`Reconnected "${currentTrack.title}".`)
      })
      .catch((error: Error) => {
        setMessage(`Failed to recover stream: ${error.message}`)
        setIsPlaying(false)
      })
  }

  const addLocalFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      return
    }

    const localTracks: Track[] = files.map((file) => {
      const objectUrl = URL.createObjectURL(file)

      return {
        id: crypto.randomUUID(),
        source: 'local',
        url: objectUrl,
        title: file.name.replace(/\.[a-zA-Z0-9]+$/, ''),
        artist: 'Local Library',
        durationSec: 0,
        localObjectUrl: objectUrl
      }
    })

    const startIndex = tracks.length
    setTracks((prev) => [...prev, ...localTracks])
    setMessage(`${localTracks.length} local track${localTracks.length > 1 ? 's' : ''} added.`)
    event.target.value = ''

    if (currentIndex < 0) {
      window.setTimeout(() => activateTrack(startIndex), 0)
    }
  }

  const togglePlayback = (): void => {
    if (!currentTrack) {
      return
    }

    setIsPlaying((prev) => !prev)
  }

  const goNext = (): void => {
    if (!tracks.length) {
      return
    }

    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tracks.length
    activateTrack(nextIndex)
  }

  const goPrev = (): void => {
    if (!tracks.length) {
      return
    }

    const nextIndex = currentIndex < 0 ? 0 : (currentIndex - 1 + tracks.length) % tracks.length
    activateTrack(nextIndex)
  }

  const seekTrack = (nextValue: number): void => {
    if (!currentTrack) {
      return
    }

    if (audioRef.current && currentTrack.source === 'local') {
      if (audioRef.current) {
        audioRef.current.currentTime = nextValue
      }
      setProgressSeconds(nextValue)
      return
    }

    setMessage('Seek is currently available for local tracks.')
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

  const renderArtwork = (track: Track | null, className: string): React.JSX.Element => {
    if (track?.thumbnail) {
      return <img className={className} src={track.thumbnail} alt={`${track.title} artwork`} />
    }

    return (
      <div className={`${className} artwork-fallback`}>
        {(track?.title?.charAt(0) || 'G').toUpperCase()}
      </div>
    )
  }

  return (
    <div className="window-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <div className="app-shell">
        <aside className="sidebar">
          <h1>Gita</h1>
          <p className="sidebar-subtitle">Music player by Shayy</p>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveNav(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {activeNav === 'browse' && (
            <section className="browse-panel">
              <div className="browse-header">
                <h2>Search</h2>
                <div className="search-bar">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Search for songs here..."
                  />
                  <button onClick={onSearch} disabled={searching}>
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              <ul className="search-results">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <li key={result.id} className="search-item">
                      {renderArtwork(result, 'search-art')}
                      <div>
                        <p className="queue-title">{result.title}</p>
                        <p className="queue-artist">
                          {result.artist} • {formatTime(result.durationSec)}
                        </p>
                      </div>
                      <div className="search-actions">
                        <button onClick={() => addTrackToQueue(result, true)}>Play</button>
                        <button onClick={() => addTrackToQueue(result, false)}>Add</button>
                        <button onClick={() => toggleFavouriteTrack(result)}>
                          {isFavourite(result.id) ? 'Unfav' : 'Fav'}
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedPlaylistId) {
                              setActiveNav('playlists')
                              setMessage('Create a playlist first, then add tracks from search.')
                              return
                            }
                            addTrackToPlaylist(selectedPlaylistId, result)
                          }}
                        >
                          +PL
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty-state">Search for a track to start building your queue.</li>
                )}
              </ul>
            </section>
          )}

          {activeNav === 'playlists' && (
            <section className="content-panel">
              <h2>Playlists</h2>
              <p className="content-subtitle">Create playlists and save tracks from search, queue, or now playing.</p>
              <div className="inline-form">
                <input
                  value={playlistDraftName}
                  onChange={(event) => setPlaylistDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      createPlaylist()
                    }
                  }}
                  placeholder="New playlist name"
                />
                <button onClick={createPlaylist}>Create</button>
              </div>
              <label className="upload">
                Import local audio
                <input type="file" accept="audio/*" multiple onChange={addLocalFiles} />
              </label>

              {playlists.length ? (
                <>
                  <div className="playlist-tabs">
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        type="button"
                        className={selectedPlaylistId === playlist.id ? 'playlist-tab active' : 'playlist-tab'}
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                      >
                        {playlist.name}
                      </button>
                    ))}
                  </div>

                  {selectedPlaylist ? (
                    <>
                      <div className="playlist-toolbar">
                        <p className="content-subtitle">{selectedPlaylist.trackIds.length} track(s)</p>
                        <button onClick={() => deletePlaylist(selectedPlaylist.id)}>Delete Playlist</button>
                      </div>
                      <ul className="collection-list">
                        {selectedPlaylistTracks.length ? (
                          selectedPlaylistTracks.map((track) => (
                            <li key={`${selectedPlaylist.id}:${track.id}`} className="collection-item">
                              {renderArtwork(track, 'queue-art')}
                              <div>
                                <p className="queue-title">{track.title}</p>
                                <p className="queue-artist">
                                  {track.artist} • {formatTime(track.durationSec)}
                                </p>
                              </div>
                              <div className="collection-actions">
                                <button onClick={() => addTrackToQueue(track, true)}>Play</button>
                                <button onClick={() => addTrackToQueue(track, false)}>Queue</button>
                                <button onClick={() => removeTrackFromPlaylist(selectedPlaylist.id, track.id)}>
                                  Remove
                                </button>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="empty-state">This playlist is empty. Add tracks from browse or queue.</li>
                        )}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="empty-state">No playlists yet. Create your first playlist above.</p>
              )}
            </section>
          )}

          {activeNav === 'favourites' && (
            <section className="content-panel">
              <h2>Favourites</h2>
              <p className="content-subtitle">Your saved tracks, synced from local storage.</p>
              <ul className="collection-list">
                {favouriteTracks.length ? (
                  favouriteTracks.map((track) => (
                    <li key={`fav:${track.id}`} className="collection-item">
                      {renderArtwork(track, 'queue-art')}
                      <div>
                        <p className="queue-title">{track.title}</p>
                        <p className="queue-artist">
                          {track.artist} • {formatTime(track.durationSec)}
                        </p>
                      </div>
                      <div className="collection-actions">
                        <button onClick={() => addTrackToQueue(track, true)}>Play</button>
                        <button onClick={() => addTrackToQueue(track, false)}>Queue</button>
                        <button onClick={() => toggleFavouriteTrack(track)}>Remove</button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty-state">No favourites yet. Tap Fav on tracks in browse or queue.</li>
                )}
              </ul>
            </section>
          )}

          {activeNav === 'settings' && (
            <section className="content-panel settings-panel">
              <h2>Settings</h2>
              <p className="settings-section-title">Discord RPC</p>
              <input
                value={rpcClientId}
                onChange={(event) => setRpcClientId(event.target.value)}
                placeholder="Discord Client ID"
              />
              <button onClick={saveDiscordClientId}>Save RPC Client ID</button>
              <button onClick={sendTestRpc}>Test RPC</button>
              <p className="rpc-status">{rpcStatusText}</p>
            </section>
          )}

          <section className="player-card">
            <audio
              ref={audioRef}
              src={currentAudioSrc || undefined}
              preload="auto"
              onWaiting={() => {
                if (currentTrack && currentTrack.source !== 'local') {
                  setMessage(`Buffering "${currentTrack.title}"...`)
                }
              }}
              onStalled={() => {
                tryRecoverRemoteStream('stalled')
              }}
              onError={() => {
                tryRecoverRemoteStream('audio error')
              }}
              onLoadedMetadata={(event) => {
                if (event.currentTarget.duration > 0) {
                  setDurationSeconds(event.currentTarget.duration)
                }
              }}
              onTimeUpdate={(event) => {
                setProgressSeconds(event.currentTarget.currentTime)
              }}
              onEnded={goNext}
            />

            <div className="player-now-playing">
              {renderArtwork(currentTrack, 'now-playing-art')}
              <div>
                <p className="eyebrow">Now Playing</p>
                <p className="now-playing-title">{currentTrack?.title || 'No track selected'}</p>
                <p className="artist-line">{currentTrack?.artist || 'Search and play a song'}</p>
              </div>
              <div className="now-playing-side">
                <p className={currentTrack ? SOURCE_STYLES[currentTrack.source] : 'source-chip'}>
                  {currentTrack ? sourceLabel[currentTrack.source] : 'No Source'}
                </p>
                {currentTrack ? (
                  <div className="now-playing-actions">
                    <button onClick={() => toggleFavouriteTrack(currentTrack)}>
                      {isFavourite(currentTrack.id) ? 'Unfav' : 'Fav'}
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedPlaylistId) {
                          setActiveNav('playlists')
                          setMessage('Create a playlist first, then add this track.')
                          return
                        }
                        addTrackToPlaylist(selectedPlaylistId, currentTrack)
                      }}
                    >
                      +Playlist
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="transport">
              <button onClick={goPrev}>Prev</button>
              <button onClick={togglePlayback} disabled={!currentTrack}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button onClick={goNext}>Next</button>
            </div>

            <div className="progress-wrap">
              <span>{formatTime(progressSeconds)}</span>
              <input
                type="range"
                min={0}
                max={durationSeconds || 0}
                step={1}
                disabled={!canSeek || durationSeconds <= 0}
                value={Math.min(progressSeconds, durationSeconds || 0)}
                onChange={(event) => seekTrack(Number(event.target.value))}
              />
              <span>{formatTime(durationSeconds)}</span>
            </div>

            <p className="hint">
              Native playback with full transport controls. Seeking is enabled for local tracks.
            </p>
          </section>
        </main>

        <aside className="queue-panel">
          <h2>Queue</h2>
          <p className="status-message">{message}</p>
          <ul>
            {tracks.length ? (
              tracks.map((track, index) => (
                <li
                  key={track.id}
                  className={index === currentIndex ? 'queue-item active' : 'queue-item'}
                  onClick={() => activateTrack(index)}
                >
                  {renderArtwork(track, 'queue-art')}
                  <div>
                    <p className="queue-title">{track.title}</p>
                    <p className="queue-artist">
                      {track.artist} • {formatTime(track.durationSec)}
                    </p>
                  </div>
                  <div className="queue-item-side">
                    <span className={SOURCE_STYLES[track.source]}>{sourceLabel[track.source]}</span>
                    <div className="queue-mini-actions">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleFavouriteTrack(track)
                        }}
                      >
                        {isFavourite(track.id) ? 'Unfav' : 'Fav'}
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!selectedPlaylistId) {
                            setActiveNav('playlists')
                            setMessage('Create a playlist first, then add tracks from queue.')
                            return
                          }
                          addTrackToPlaylist(selectedPlaylistId, track)
                        }}
                      >
                        +PL
                      </button>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="empty-state">
                Your queue is empty. Add songs from search or local files.
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}

export default App
