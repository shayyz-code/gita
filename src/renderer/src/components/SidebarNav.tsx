import { Compass, Library, Settings, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../lib/constants'
import type { NavSection, Playlist } from '../lib/types'
import gitaLogo from '../assets/gita.png'

function navIcon(name: NavSection): React.JSX.Element {
  if (name === 'browse') return <Compass className="icon" />
  if (name === 'playlists') return <Library className="icon" />
  if (name === 'favourites') return <Star className="icon" />
  return <Settings className="icon" />
}

type SidebarNavProps = {
  playlists: Playlist[]
}

function SidebarNav({ playlists }: SidebarNavProps): React.JSX.Element {
  const playlistLinks = playlists.slice(0, 5)

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <img src={gitaLogo} alt="Gita logo" className="brand-logo" />
        <h1 className="brand-title">Gita</h1>
      </div>
      <p className="sidebar-subtitle">Music player by Shayy</p>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          if (item.id !== 'playlists') {
            return (
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
            )
          }

          return (
            <div key={item.id} className="nav-group">
              <NavLink
                to={`/${item.id}`}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                <span className="btn-with-icon">
                  {navIcon(item.id)}
                  <span>{item.label}</span>
                </span>
              </NavLink>
              {playlistLinks.length ? (
                <div className="playlist-subnav">
                  {playlistLinks.map((playlist) => (
                    <NavLink
                      key={playlist.id}
                      to={`/playlist/${playlist.id}`}
                      className={({ isActive }) =>
                        isActive ? 'playlist-subnav-item active' : 'playlist-subnav-item'
                      }
                    >
                      {playlist.name}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default SidebarNav
