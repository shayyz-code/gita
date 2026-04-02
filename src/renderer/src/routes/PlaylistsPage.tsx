import { ListPlus, Play, Plus, Trash2, Upload } from 'lucide-react'
import type { Playlist, Track } from '../lib/types'
import TrackArtwork from '../components/TrackArtwork'

type PlaylistsPageProps = {
  playlists: Playlist[]
  selectedPlaylistId: string
  selectedPlaylistTracks: Track[]
  playlistDraftName: string
  formatTime: (seconds: number) => string
  onDraftChange: (value: string) => void
  onCreatePlaylist: () => void
  onSelectPlaylist: (playlistId: string) => void
  onDeletePlaylist: (playlistId: string) => void
  onPlayTrack: (track: Track) => void
  onQueueTrack: (track: Track) => void
  onRemoveTrack: (playlistId: string, trackId: string) => void
  onImportLocalFiles: (event: React.ChangeEvent<HTMLInputElement>) => void
}

function PlaylistsPage(props: PlaylistsPageProps): React.JSX.Element {
  const {
    playlists,
    selectedPlaylistId,
    selectedPlaylistTracks,
    playlistDraftName,
    formatTime,
    onDraftChange,
    onCreatePlaylist,
    onSelectPlaylist,
    onDeletePlaylist,
    onPlayTrack,
    onQueueTrack,
    onRemoveTrack,
    onImportLocalFiles
  } = props

  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null

  return (
    <section className="content-panel">
      <h2>Playlists</h2>
      <p className="content-subtitle">Create playlists and save tracks from search, queue, or now playing.</p>
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
        <>
          <div className="playlist-tabs">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className={selectedPlaylistId === playlist.id ? 'playlist-tab active' : 'playlist-tab'}
                onClick={() => onSelectPlaylist(playlist.id)}
              >
                {playlist.name}
              </button>
            ))}
          </div>

          {selectedPlaylist ? (
            <>
              <div className="playlist-toolbar">
                <p className="content-subtitle">{selectedPlaylist.trackIds.length} track(s)</p>
                <button
                  className="icon-only-btn"
                  onClick={() => onDeletePlaylist(selectedPlaylist.id)}
                  title="Delete playlist"
                >
                  <Trash2 className="icon" />
                </button>
              </div>
              <ul className="collection-list">
                {selectedPlaylistTracks.length ? (
                  selectedPlaylistTracks.map((track) => (
                    <li key={`${selectedPlaylist.id}:${track.id}`} className="collection-item">
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
                          onClick={() => onRemoveTrack(selectedPlaylist.id, track.id)}
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
            </>
          ) : null}
        </>
      ) : (
        <p className="empty-state">No playlists yet. Create your first playlist above.</p>
      )}
    </section>
  )
}

export default PlaylistsPage
