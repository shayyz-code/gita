import { Pin, Plus, Trash2, Upload } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { Playlist } from '../lib/types'

type PlaylistsPageProps = {
  playlists: Playlist[]
  playlistDraftName: string
  onDraftChange: (value: string) => void
  onCreatePlaylist: () => void
  onDeletePlaylist: (playlistId: string) => void
  onTogglePinPlaylist: (playlistId: string) => void
  onImportLocalFiles: (event: React.ChangeEvent<HTMLInputElement>) => void
}

function PlaylistsPage(props: PlaylistsPageProps): React.JSX.Element {
  const {
    playlists,
    playlistDraftName,
    onDraftChange,
    onCreatePlaylist,
    onDeletePlaylist,
    onTogglePinPlaylist,
    onImportLocalFiles
  } = props

  return (
    <section className="content-panel">
      <h2>Playlists</h2>
      <p className="content-subtitle">Create playlists and open them like albums.</p>
      <div className="inline-form">
        <input
          value={playlistDraftName}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCreatePlaylist()
            }
          }}
          placeholder="New playlist name"
        />
        <button className="icon-only-btn" onClick={onCreatePlaylist} title="Create playlist">
          <Plus className="icon" />
        </button>
      </div>
      <label className="upload">
        <span className="btn-with-icon">
          <Upload className="icon" />
          <span>Import local audio</span>
        </span>
        <input type="file" accept="audio/*" multiple onChange={onImportLocalFiles} />
      </label>

      {playlists.length ? (
        <ul className="collection-list">
          {playlists.map((playlist) => (
            <li key={playlist.id} className="collection-item">
              <div className="queue-art artwork-fallback">{playlist.name.charAt(0).toUpperCase()}</div>
              <div>
                <NavLink to={`/playlist/${playlist.id}`} className="playlist-link">
                  {playlist.name}
                </NavLink>
                <p className="queue-artist">{playlist.trackIds.length} track(s)</p>
              </div>
              <div className="collection-actions">
                <button
                  className="icon-only-btn"
                  onClick={() => onTogglePinPlaylist(playlist.id)}
                  title={playlist.pinned ? 'Unpin playlist' : 'Pin playlist'}
                >
                  <Pin className="icon" />
                </button>
                <button
                  className="icon-only-btn"
                  onClick={() => onDeletePlaylist(playlist.id)}
                  title="Delete playlist"
                >
                  <Trash2 className="icon" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No playlists yet. Create your first playlist above.</p>
      )}
    </section>
  )
}

export default PlaylistsPage
