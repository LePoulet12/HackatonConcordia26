import { useCallback, useEffect, useState } from 'react'
import {
  House,
  Bus,
  MessageCircle,
  FileText,
  BookOpen,
  Settings,
} from 'lucide-react'

import './App.css'
import Horaire from './pages/Horaire'
import { api } from './pages/horaireApi'

const tokenKey = 'campus-token'

const items = [
  ['campus', 'Mon campus', House],
  ['horaire', 'Horaire et bus', Bus],
  ['forum', 'Forum', MessageCircle],
  ['notes', 'Notes partagées', FileText],
  ['cours', 'Mes cours', BookOpen],
]

export default function App() {
  const [active, setActive] = useState(
    () => window.location.hash.slice(1) || 'horaire'
  )

  const [token, setToken] = useState(
    () => localStorage.getItem(tokenKey)
  )

  const [account, setAccount] = useState(null)

  const disconnect = useCallback(() => {
    localStorage.removeItem(tokenKey)
    setToken(null)
    setAccount(null)
  }, [])

  function connect(nextToken) {
    localStorage.setItem(tokenKey, nextToken)
    setAccount(null)
    setToken(nextToken)
  }

  useEffect(() => {
    function synchroniserNavigation() {
      setActive(window.location.hash.slice(1) || 'horaire')
    }

    window.addEventListener('hashchange', synchroniserNavigation)

    return () => {
      window.removeEventListener('hashchange', synchroniserNavigation)
    }
  }, [])

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()

    api('/api/auth/moi', {
      token,
      signal: controller.signal,
    })
      .then((user) => {
        if (!controller.signal.aborted) {
          setAccount(user)
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.status === 401) {
          disconnect()
        }
      })

    return () => controller.abort()
  }, [token, disconnect])

  return (
    <>
      <aside className="sidebar" aria-label="Menu Campus">
        <a
          className="brand"
          href="#campus"
          onClick={() => setActive('campus')}
        >
          <span className="brand-mark">C</span>
          Campus
        </a>

        <nav aria-label="Navigation principale">
          {items.map(([id, label, IconComponent]) => (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-item ${active === id ? 'active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => setActive(id)}
            >
              <IconComponent
                size={22}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a
            href="#parametres"
            className={`nav-item ${
              active === 'parametres' ? 'active' : ''
            }`}
            aria-current={
              active === 'parametres' ? 'page' : undefined
            }
            onClick={() => setActive('parametres')}
          >
            <Settings
              size={22}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Paramètres</span>
          </a>

          {token ? (
            <button
              className="profile session-profile"
              onClick={disconnect}
              type="button"
              aria-label="Se déconnecter"
            >
              <span className="avatar">
                {account?.pseudo?.[0]?.toUpperCase() || 'C'}
              </span>

              <span>
                <strong>{account?.pseudo || 'Mon compte'}</strong>
                <small>Se déconnecter</small>
              </span>
            </button>
          ) : (
            <a
              className="profile"
              href="#horaire"
              aria-label="Se connecter"
              onClick={() => setActive('horaire')}
            >
              <span className="avatar" aria-hidden="true">
                ↪
              </span>
              <strong>Se connecter</strong>
            </a>
          )}
        </div>
      </aside>

      {active === 'horaire' && (
        <Horaire
          key={token || 'guest'}
          token={token}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      )}
    </>
  )
}