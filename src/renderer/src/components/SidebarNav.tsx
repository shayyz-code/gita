import { Compass, Library, Settings, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../lib/constants'
import type { NavSection, Playlist } from '../lib/types'

function navIcon(name: NavSection): React.JSX.Element {
  if (name === 'browse') return <Compass className="icon" />
  if (name === 'playlists') return <Library className="icon" />
  if (name === 'favourites') return <Star className="icon" />
  return <Settings className="icon" />
}

type SidebarNavProps = {
  pinnedPlaylists: Playlist[]
}

function SidebarNav({ pinnedPlaylists }: SidebarNavProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <h1>Gita</h1>
      <p className="sidebar-subtitle">Music player by Shayy</p>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={`/${item.id}`}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="btn-with-icon">
              {navIcon(item.id)}
              <span>{item.label}</span>
            </span>
          </NavLink>
        ))}
      </nav>
      {pinnedPlaylists.length ? (
        <div className="pinned-nav">
          <p className="sidebar-subtitle pinned-label">Pinned Playlists</p>
          <nav className="sidebar-nav">
            {pinnedPlaylists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                <span className="btn-with-icon">
                  <Library className="icon" />
                  <span>{playlist.name}</span>
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </aside>
  )
}

export default SidebarNav
