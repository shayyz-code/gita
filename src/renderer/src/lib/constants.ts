import type { NavSection, SourceType } from './types'

export const sourceLabel: Record<SourceType, string> = {
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  local: 'Local'
}

export const SOURCE_STYLES: Record<SourceType, string> = {
  youtube: 'source-chip source-chip-youtube',
  soundcloud: 'source-chip source-chip-soundcloud',
  local: 'source-chip source-chip-local'
}

export const NAV_ITEMS: Array<{ id: NavSection; label: string }> = [
  { id: 'browse', label: 'Browse' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'settings', label: 'Settings' }
]
