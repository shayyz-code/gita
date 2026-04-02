import { Heart } from 'lucide-react'
import { SOURCE_STYLES, sourceLabel } from '../lib/constants'
import type { Playlist, Track } from '../lib/types'
import MoreMenu from './MoreMenu'
import TrackArtwork from './TrackArtwork'

type QueuePanelProps = {
  tracks: Track[]
  currentIndex: number
  message: string
  formatTime: (seconds: number) => string
  isFavourite: (trackId: string) => boolean
  playlists: Playlist[]
  onActivateTrack: (index: number) => void
  onToggleFavourite: (track: Track) => void
  onAddToPlaylist: (playlistId: string, track: Track) => void
  onRequireCreatePlaylist: () => void
}

function QueuePanel(props: QueuePanelProps): React.JSX.Element {
  const {
    tracks,
    currentIndex,
    message,
    formatTime,
    isFavourite,
    playlists,
    onActivateTrack,
    onToggleFavourite,
    onAddToPlaylist,
    onRequireCreatePlaylist
  } = props

  return (
    <aside className="queue-panel">
      <h2>Queue</h2>
      <p className="status-message">{message}</p>
      <ul>
        {tracks.length ? (
          tracks.map((track, index) => (
            <li
              key={track.id}
              className={index === currentIndex ? 'queue-item active' : 'queue-item'}
              onClick={() => onActivateTrack(index)}
            >
              <TrackArtwork track={track} className="queue-art" />
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
                    className="icon-only-btn"
                    title={isFavourite(track.id) ? 'Remove from favourites' : 'Add to favourites'}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleFavourite(track)
                    }}
                  >
                    <Heart className="icon" />
                  </button>
                  <MoreMenu
                    track={track}
                    playlists={playlists}
                    onAddToPlaylist={onAddToPlaylist}
                    onRequireCreatePlaylist={onRequireCreatePlaylist}
                    stopPropagation
                  />
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="empty-state">Your queue is empty. Add songs from search or local files.</li>
        )}
      </ul>
    </aside>
  )
}

export default QueuePanel
