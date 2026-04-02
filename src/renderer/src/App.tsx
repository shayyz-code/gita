import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import SidebarNav from './components/SidebarNav'
import PlayerCard from './components/PlayerCard'
import QueuePanel from './components/QueuePanel'
import { sourceLabel } from './lib/constants'
import { formatTime } from './lib/format'
import type { Playlist, Track, TrackLibrary } from './lib/types'
import BrowsePage from './routes/BrowsePage'
import FavouritesPage from './routes/FavouritesPage'
import PlaylistAlbumPage from './routes/PlaylistAlbumPage'
import PlaylistsPage from './routes/PlaylistsPage'
import SettingsPage from './routes/SettingsPage'

const envDiscordClientId = (import.meta.env.VITE_DISCORD_CLIENT_ID || '').trim()

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
  const navigate = useNavigate()

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

  const [playlistDraftName, setPlaylistDraftName] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [favouriteTrackIds, setFavouriteTrackIds] = useState<string[]>([])
  const [trackLibrary, setTrackLibrary] = useState<TrackLibrary>({})

  const [rpcClientId, setRpcClientId] = useState(
    () => envDiscordClientId || localStorage.getItem('gita.discordClientId') || ''
  )
  const [rpcStatusText, setRpcStatusText] = useState('Discord RPC not configured')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTrackIdRef = useRef<string>('')
  const retryByTrackRef = useRef<Record<string, number>>({})
  const initialRpcClientIdRef = useRef(rpcClientId)
  const tracksRef = useRef<Track[]>([])
  const collectionsHydratedRef = useRef(false)

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

  const currentTrack = currentIndex >= 0 ? (tracks[currentIndex] ?? null) : null
  const canSeek = currentTrack?.source === 'local'
  const effectiveSelectedPlaylistId = playlists.some((playlist) => playlist.id === selectedPlaylistId)
    ? selectedPlaylistId
    : (playlists[0]?.id ?? '')
  const selectedPlaylist =
    playlists.find((playlist) => playlist.id === effectiveSelectedPlaylistId) || null
  const favouriteTracks = favouriteTrackIds
    .map((trackId) => resolveTrackById(trackId))
    .filter((track): track is Track => Boolean(track))
  const pinnedPlaylists = playlists.filter((playlist) => Boolean(playlist.pinned))
  const selectedPlaylistTracks = selectedPlaylist
    ? selectedPlaylist.trackIds
        .map((trackId) => resolveTrackById(trackId))
        .filter((track): track is Track => Boolean(track))
    : []

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    void window.api
      .collectionsGetState()
      .then((state) => {
        setPlaylists(state.playlists || [])
        setFavouriteTrackIds(state.favourites || [])
        setTrackLibrary(state.library || {})
        collectionsHydratedRef.current = true
      })
      .catch(() => {
        collectionsHydratedRef.current = true
      })
  }, [])

  useEffect(() => {
    if (!collectionsHydratedRef.current) {
      return
    }

    void window.api.collectionsSetState({
      playlists,
      favourites: favouriteTrackIds,
      library: trackLibrary
    })
  }, [playlists, favouriteTrackIds, trackLibrary])

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

    let targetName = 'playlist'
    let wasAdded = false

    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist
        }

        targetName = playlist.name
        if (playlist.trackIds.includes(track.id)) {
          return playlist
        }

        wasAdded = true
        return {
          ...playlist,
          trackIds: [...playlist.trackIds, track.id]
        }
      })
    )

    if (wasAdded) {
      setMessage(`Added "${track.title}" to "${targetName}".`)
    } else {
      setMessage(`"${track.title}" is already in "${targetName}".`)
    }
  }

  const onRequireCreatePlaylist = (): void => {
    navigate('/playlists')
    setMessage('Create a playlist first, then add tracks from More menu.')
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

  const createPlaylist = (): void => {
    const name = playlistDraftName.trim()
    if (!name) {
      setMessage('Enter a playlist name first.')
      return
    }

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name,
      trackIds: [],
      pinned: false
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

  const togglePinPlaylist = (playlistId: string): void => {
    let nextPinned = false
    let playlistName = 'Playlist'

    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist
        }

        playlistName = playlist.name
        nextPinned = !playlist.pinned
        return {
          ...playlist,
          pinned: nextPinned
        }
      })
    )

    setMessage(nextPinned ? `"${playlistName}" pinned to sidebar.` : `"${playlistName}" unpinned.`)
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
      audioRef.current.currentTime = nextValue
      setProgressSeconds(nextValue)
      return
    }

    setMessage('Seek is currently available for local tracks.')
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
    <div className="window-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <div className="app-shell">
        <SidebarNav pinnedPlaylists={pinnedPlaylists} />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/browse" replace />} />
            <Route
              path="/browse"
              element={
                <BrowsePage
                  searchQuery={searchQuery}
                  searching={searching}
                  searchResults={searchResults}
                  playlists={playlists}
                  formatTime={formatTime}
                  isFavourite={isFavourite}
                  onSearchQueryChange={setSearchQuery}
                  onSearch={onSearch}
                  onSearchKeyDown={onSearchKeyDown}
                  onPlayTrack={(track) => addTrackToQueue(track, true)}
                  onQueueTrack={(track) => addTrackToQueue(track, false)}
                  onToggleFavourite={toggleFavouriteTrack}
                  onAddToPlaylist={addTrackToPlaylist}
                  onRequireCreatePlaylist={onRequireCreatePlaylist}
                />
              }
            />
            <Route
              path="/playlists"
              element={
                <PlaylistsPage
                  playlists={playlists}
                  selectedPlaylistId={effectiveSelectedPlaylistId}
                  selectedPlaylistTracks={selectedPlaylistTracks}
                  playlistDraftName={playlistDraftName}
                  formatTime={formatTime}
                  onDraftChange={setPlaylistDraftName}
                  onCreatePlaylist={createPlaylist}
                  onSelectPlaylist={setSelectedPlaylistId}
                  onDeletePlaylist={deletePlaylist}
                  onTogglePinPlaylist={togglePinPlaylist}
                  onPlayTrack={(track) => addTrackToQueue(track, true)}
                  onQueueTrack={(track) => addTrackToQueue(track, false)}
                  onRemoveTrack={removeTrackFromPlaylist}
                  onImportLocalFiles={addLocalFiles}
                />
              }
            />
            <Route
              path="/playlist/:playlistId"
              element={
                <PlaylistAlbumPage
                  playlists={playlists}
                  resolveTrackById={resolveTrackById}
                  formatTime={formatTime}
                  onPlayTrack={(track) => addTrackToQueue(track, true)}
                  onQueueTrack={(track) => addTrackToQueue(track, false)}
                  onRemoveTrack={removeTrackFromPlaylist}
                  onTogglePinPlaylist={togglePinPlaylist}
                />
              }
            />
            <Route
              path="/favourites"
              element={
                <FavouritesPage
                  tracks={favouriteTracks}
                  formatTime={formatTime}
                  onPlayTrack={(track) => addTrackToQueue(track, true)}
                  onQueueTrack={(track) => addTrackToQueue(track, false)}
                  onRemoveFavourite={toggleFavouriteTrack}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  rpcClientId={rpcClientId}
                  rpcStatusText={rpcStatusText}
                  onRpcClientIdChange={setRpcClientId}
                  onSaveRpc={saveDiscordClientId}
                  onTestRpc={sendTestRpc}
                />
              }
            />
          </Routes>

          <PlayerCard
            audioRef={audioRef}
            currentAudioSrc={currentAudioSrc}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progressSeconds={progressSeconds}
            durationSeconds={durationSeconds}
            canSeek={canSeek}
            playlists={playlists}
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
            onPrev={goPrev}
            onTogglePlayback={togglePlayback}
            onNext={goNext}
            onSeek={seekTrack}
            onToggleFavourite={toggleFavouriteTrack}
            isFavourite={isFavourite}
            onAddToPlaylist={addTrackToPlaylist}
            onRequireCreatePlaylist={onRequireCreatePlaylist}
            formatTime={formatTime}
          />
        </main>

        <QueuePanel
          tracks={tracks}
          currentIndex={currentIndex}
          message={message}
          formatTime={formatTime}
          isFavourite={isFavourite}
          playlists={playlists}
          onActivateTrack={activateTrack}
          onToggleFavourite={toggleFavouriteTrack}
          onAddToPlaylist={addTrackToPlaylist}
          onRequireCreatePlaylist={onRequireCreatePlaylist}
        />
      </div>
    </div>
  )
}

export default App
