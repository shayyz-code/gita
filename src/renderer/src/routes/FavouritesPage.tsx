import { Heart, ListPlus, Play } from 'lucide-react'
import type { Track } from '../lib/types'
import TrackArtwork from '../components/TrackArtwork'

type FavouritesPageProps = {
  tracks: Track[]
  formatTime: (seconds: number) => string
  onPlayTrack: (track: Track) => void
  onQueueTrack: (track: Track) => void
  onRemoveFavourite: (track: Track) => void
}

function FavouritesPage({
  tracks,
  formatTime,
  onPlayTrack,
  onQueueTrack,
  onRemoveFavourite
}: FavouritesPageProps): React.JSX.Element {
  return (
    <section className="content-panel">
      <h2>Favourites</h2>
      <p className="content-subtitle">Your saved tracks, synced from local storage.</p>
      <ul className="collection-list">
        {tracks.length ? (
          tracks.map((track) => (
            <li key={`fav:${track.id}`} className="collection-item">
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
                <button className="icon-only-btn" title="Remove from favourites" onClick={() => onRemoveFavourite(track)}>
                  <Heart className="icon" />
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="empty-state">No favourites yet. Tap heart on tracks in browse or queue.</li>
        )}
      </ul>
    </section>
  )
}

export default FavouritesPage
