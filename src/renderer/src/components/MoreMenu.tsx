import { ListPlus, MoreHorizontal, Plus } from 'lucide-react'
import type { Playlist, Track } from '../lib/types'

type MoreMenuProps = {
  track: Track
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string, track: Track) => void
  onRequireCreatePlaylist: () => void
  stopPropagation?: boolean
}

function MoreMenu({
  track,
  playlists,
  onAddToPlaylist,
  onRequireCreatePlaylist,
  stopPropagation = false
}: MoreMenuProps): React.JSX.Element {
  return (
    <details className="more-menu" onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}>
      <summary
        className="icon-only-btn more-trigger"
        title="More"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <MoreHorizontal className="icon" />
      </summary>
      <div className="more-menu-popover">
        {playlists.length ? (
          playlists.map((playlist) => (
            <button
              key={`${track.id}:${playlist.id}`}
              type="button"
              className="more-menu-item"
              onClick={(event) => {
                if (stopPropagation) {
                  event.stopPropagation()
                }
                onAddToPlaylist(playlist.id, track)
              }}
            >
              <ListPlus className="icon" />
              <span>Add to {playlist.name}</span>
            </button>
          ))
        ) : (
          <button
            type="button"
            className="more-menu-item"
            onClick={(event) => {
              if (stopPropagation) {
                event.stopPropagation()
              }
              onRequireCreatePlaylist()
            }}
          >
            <Plus className="icon" />
            <span>Create playlist</span>
          </button>
        )}
      </div>
    </details>
  )
}

export default MoreMenu
