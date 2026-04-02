import type { Track } from '../lib/types'

type TrackArtworkProps = {
  track: Track | null
  className: string
}

function TrackArtwork({ track, className }: TrackArtworkProps): React.JSX.Element {
  if (track?.thumbnail) {
    return <img className={className} src={track.thumbnail} alt={`${track.title} artwork`} />
  }

  return <div className={`${className} artwork-fallback`}>{(track?.title?.charAt(0) || 'G').toUpperCase()}</div>
}

export default TrackArtwork
