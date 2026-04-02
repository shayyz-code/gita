import { Heart, ListPlus, Play, Search } from 'lucide-react'
import type { Track } from '../lib/types'
import MoreMenu from '../components/MoreMenu'
import TrackArtwork from '../components/TrackArtwork'

type BrowsePageProps = {
  searchQuery: string
  searching: boolean
  searchResults: Track[]
  playlists: Array<{ id: string; name: string; trackIds: string[] }>
  formatTime: (seconds: number) => string
  isFavourite: (trackId: string) => boolean
  onSearchQueryChange: (value: string) => void
  onSearch: () => void
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onPlayTrack: (track: Track) => void
  onQueueTrack: (track: Track) => void
  onToggleFavourite: (track: Track) => void
  onAddToPlaylist: (playlistId: string, track: Track) => void
  onRequireCreatePlaylist: () => void
}

function BrowsePage(props: BrowsePageProps): React.JSX.Element {
  const {
    searchQuery,
    searching,
    searchResults,
    playlists,
    formatTime,
    isFavourite,
    onSearchQueryChange,
    onSearch,
    onSearchKeyDown,
    onPlayTrack,
    onQueueTrack,
    onToggleFavourite,
    onAddToPlaylist,
    onRequireCreatePlaylist
  } = props

  return (
    <section className="browse-panel">
      <div className="browse-header">
        <h2>Search</h2>
        <div className="search-bar">
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search for songs here..."
          />
          <button className="icon-only-btn" onClick={onSearch} disabled={searching} title={searching ? 'Searching' : 'Search'}>
            <Search className="icon" />
          </button>
        </div>
      </div>

      <ul className="search-results">
        {searchResults.length ? (
          searchResults.map((result) => (
            <li key={result.id} className="search-item">
              <TrackArtwork track={result} className="search-art" />
              <div>
                <p className="queue-title">{result.title}</p>
                <p className="queue-artist">
                  {result.artist} • {formatTime(result.durationSec)}
                </p>
              </div>
              <div className="search-actions">
                <button className="icon-only-btn" title="Play now" onClick={() => onPlayTrack(result)}>
                  <Play className="icon" />
                </button>
                <button className="icon-only-btn" title="Add to queue" onClick={() => onQueueTrack(result)}>
                  <ListPlus className="icon" />
                </button>
                <button
                  className="icon-only-btn"
                  title={isFavourite(result.id) ? 'Remove from favourites' : 'Add to favourites'}
                  onClick={() => onToggleFavourite(result)}
                >
                  <Heart className="icon" />
                </button>
                <MoreMenu
                  track={result}
                  playlists={playlists}
                  onAddToPlaylist={onAddToPlaylist}
                  onRequireCreatePlaylist={onRequireCreatePlaylist}
                />
              </div>
            </li>
          ))
        ) : (
          <li className="empty-state">Search for a track to start building your queue.</li>
        )}
      </ul>
    </section>
  )
}

export default BrowsePage
