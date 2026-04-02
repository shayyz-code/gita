import { Heart, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Playlist, Track } from '../lib/types'
import MoreMenu from './MoreMenu'
import TrackArtwork from './TrackArtwork'

type PlayerCardProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>
  currentAudioSrc: string
  currentTrack: Track | null
  isPlaying: boolean
  progressSeconds: number
  durationSeconds: number
  canSeek: boolean
  playlists: Playlist[]
  onWaiting: () => void
  onStalled: () => void
  onError: () => void
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) => void
  onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) => void
  onEnded: () => void
  onPrev: () => void
  onTogglePlayback: () => void
  onNext: () => void
  onSeek: (nextValue: number) => void
  onToggleFavourite: (track: Track) => void
  isFavourite: (trackId: string) => boolean
  onAddToPlaylist: (playlistId: string, track: Track) => void
  onRequireCreatePlaylist: () => void
  formatTime: (seconds: number) => string
}

function PlayerCard(props: PlayerCardProps): React.JSX.Element {
  const {
    audioRef,
    currentAudioSrc,
    currentTrack,
    isPlaying,
    progressSeconds,
    durationSeconds,
    canSeek,
    playlists,
    onWaiting,
    onStalled,
    onError,
    onLoadedMetadata,
    onTimeUpdate,
    onEnded,
    onPrev,
    onTogglePlayback,
    onNext,
    onSeek,
    onToggleFavourite,
    isFavourite,
    onAddToPlaylist,
    onRequireCreatePlaylist,
    formatTime
  } = props

  return (
    <section className="player-card">
      <audio
        ref={audioRef}
        src={currentAudioSrc || undefined}
        preload="auto"
        onWaiting={onWaiting}
        onStalled={onStalled}
        onError={onError}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />

      <div className="player-now-playing">
        <TrackArtwork track={currentTrack} className="now-playing-art" />
        <div>
          <p className="eyebrow">Now Playing</p>
          <p className="now-playing-title">{currentTrack?.title || 'No track selected'}</p>
          <p className="artist-line">{currentTrack?.artist || 'Search and play a song'}</p>
        </div>
        <div className="now-playing-side">
          {currentTrack ? (
            <div className="now-playing-actions">
              <button
                className="icon-only-btn"
                title={isFavourite(currentTrack.id) ? 'Remove from favourites' : 'Add to favourites'}
                onClick={() => onToggleFavourite(currentTrack)}
              >
                <Heart className="icon" />
              </button>
              <MoreMenu
                track={currentTrack}
                playlists={playlists}
                onAddToPlaylist={onAddToPlaylist}
                onRequireCreatePlaylist={onRequireCreatePlaylist}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="transport">
        <button className="icon-only-btn" title="Previous" onClick={onPrev}>
          <SkipBack className="icon" />
        </button>
        <button className="icon-only-btn" title={isPlaying ? 'Pause' : 'Play'} onClick={onTogglePlayback} disabled={!currentTrack}>
          {isPlaying ? <Pause className="icon" /> : <Play className="icon" />}
        </button>
        <button className="icon-only-btn" title="Next" onClick={onNext}>
          <SkipForward className="icon" />
        </button>
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
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(durationSeconds)}</span>
      </div>

      <p className="hint">Native playback with full transport controls. Seeking is enabled for local tracks.</p>
    </section>
  )
}

export default PlayerCard
