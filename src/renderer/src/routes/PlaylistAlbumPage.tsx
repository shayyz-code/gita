import { ListPlus, Pin, Play, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import TrackArtwork from '../components/TrackArtwork'
import type { Playlist, Track } from '../lib/types'

type PlaylistAlbumPageProps = {
  playlists: Playlist[]
  resolveTrackById: (trackId: string) => Track | null
  formatTime: (seconds: number) => string
  onPlayTrack: (track: Track) => void
  onQueueTrack: (track: Track) => void
  onRemoveTrack: (playlistId: string, trackId: string) => void
  onTogglePinPlaylist: (playlistId: string) => void
}

function PlaylistAlbumPage(props: PlaylistAlbumPageProps): React.JSX.Element {
  const {
    playlists,
    resolveTrackById,
    formatTime,
    onPlayTrack,
    onQueueTrack,
    onRemoveTrack,
    onTogglePinPlaylist
  } = props
  const { playlistId = '' } = useParams()

  const playlist = playlists.find((item) => item.id === playlistId) || null
  const tracks = playlist
    ? playlist.trackIds
        .map((trackId) => resolveTrackById(trackId))
        .filter((track): track is Track => Boolean(track))
    : []

  if (!playlist) {
    return (
      <section className="content-panel">
        <h2>Playlist</h2>
        <p className="empty-state">Playlist not found.</p>
      </section>
    )
  }

  return (
    <section className="content-panel album-page">
      <div className="album-hero">
        <div className="album-cover">{playlist.name.charAt(0).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Playlist</p>
          <h2 className="album-title">{playlist.name}</h2>
          <p className="content-subtitle">{playlist.trackIds.length} track(s)</p>
          <div className="album-actions">
            <button
              className="icon-only-btn"
              title={playlist.pinned ? 'Unpin playlist' : 'Pin playlist'}
              onClick={() => onTogglePinPlaylist(playlist.id)}
            >
              <Pin className="icon" />
            </button>
          </div>
        </div>
      </div>

      <ul className="collection-list">
        {tracks.length ? (
          tracks.map((track) => (
            <li key={`${playlist.id}:${track.id}`} className="collection-item">
              <TrackArtwork track={track} className="queue-art" />
              <div>
                <p className="queue-title">{track.title}</p>
                <p className="queue-artist">
                  {track.artist} • {formatTime(track.durationSec)}
                </p>
              </div>
              <div className="collection-actions">
                <button className="icon-only-btn" title="Play now" onClick={() => onPlayTrack(track)}>
                  <Play className="icon" />
                </button>
                <button className="icon-only-btn" title="Add to queue" onClick={() => onQueueTrack(track)}>
                  <ListPlus className="icon" />
                </button>
                <button
                  className="icon-only-btn"
                  title="Remove track"
                  onClick={() => onRemoveTrack(playlist.id, track.id)}
                >
                  <Trash2 className="icon" />
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="empty-state">This playlist is empty. Add tracks from browse or queue.</li>
        )}
      </ul>
    </section>
  )
}

export default PlaylistAlbumPage
