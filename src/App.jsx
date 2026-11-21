import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, CalendarClock, Database, FileSignature,
  Landmark, LineChart, PhoneCall, Scale, BarChart2, LayoutDashboard, Clock
} from 'lucide-react'
import { api } from './lib/api'
import { Toaster } from './components/ui/sonner'
import './features/originate/originate.css'
import './styles/toast.css'
import Dashboard from './views/Dashboard'
import Originate from './views/Originate'
import { OriginatePage } from './features/originate/OriginatePage'
import Portfolio from './views/Portfolio'
import Accounts from './views/Accounts'
import Watchlist from './views/Watchlist'
import Collections from './views/Collections'
import PolicyPack from './views/PolicyPack'
import MetricsView from './views/MetricsView'
import Login from './views/Login'
import PasswordResetRequest from './views/PasswordResetRequest'
import PasswordResetConfirm from './views/PasswordResetConfirm'

// Helper to decode JWT payload safely without external dependencies
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

// Module to tab mapping
const MODULE_TABS = {
  dashboard: { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  origination: { key: 'origination', label: 'Originate', icon: FileSignature },
  portfolio: { key: 'portfolio', label: 'Portfolio', icon: LineChart },
  accounts: { key: 'accounts', label: 'Accounts & Staging', icon: Landmark },
  watchlist: { key: 'watchlist', label: 'Early Warning', icon: AlertTriangle },
  collections: { key: 'collections', label: 'Collections', icon: PhoneCall },
  policy: { key: 'policy', label: 'Policy Pack', icon: Scale },
  metrics: { key: 'metrics', label: 'Metrics', icon: BarChart2 },
}

export default function App() {
  const [tab, setTab] = useState('')
  const [data, setData] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userProfile, setUserProfile] = useState(null) // Store full user profile

  // Timeout Warning Modal state
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(90)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleLogout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userData')
    setIsAuthenticated(false)
    setUserProfile(null)
    setTab('')
    setShowTimeoutModal(false)
  }, [])

  // Refreshes the token and resets session
  const handleRefreshToken = async () => {
    setIsRefreshing(true)
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      // Call API refresh endpoint (Adjust `api.refreshToken` to match your actual API method)
      const response = await api.refreshToken({ refresh: refreshToken })
      if (response && response.access) {
        localStorage.setItem('accessToken', response.access)
        if (response.refresh) {
          localStorage.setItem('refreshToken', response.refresh)
        }
        setShowTimeoutModal(false)
      } else {
        throw new Error('Failed to refresh token')
      }
    } catch (e) {
      setError(`Session expired: ${e.message}`)
      handleLogout()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Token Monitoring & Timeout Warning Logic
  useEffect(() => {
    if (!isAuthenticated) return

    const checkTokenExpiration = () => {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        handleLogout()
        return
      }

      const decoded = parseJwt(token)
      if (!decoded || !decoded.exp) {
        return
      }

      const expiresAt = decoded.exp * 1000 // Convert JWT `exp` (seconds) to milliseconds
      const now = Date.now()
      const timeRemainingMs = expiresAt - now
      const timeRemainingSec = Math.floor(timeRemainingMs / 1000)

      if (timeRemainingSec <= 0) {
        // Token has expired -> log out
        handleLogout()
      } else if (timeRemainingSec <= 90) {
        // Within 20 seconds threshold -> display modal and countdown
        setShowTimeoutModal(true)
        setSecondsRemaining(timeRemainingSec)
      } else {
        // Normal state -> hide modal
        setShowTimeoutModal(false)
      }
    }

    // Run check immediately and periodically every second
    checkTokenExpiration()
    const interval = setInterval(checkTokenExpiration, 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, handleLogout])

  // Check for existing token and user data on initial load
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const userDataStr = localStorage.getItem('userData')
    if (token && userDataStr) {
      try {
        const userData = JSON.parse(userDataStr)
        setIsAuthenticated(true)
        setUserProfile(userData)
      } catch (e) {
        // If parsing fails, clear storage and remain unauthenticated
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userData')
      }
    }
  }, [])

  // Set initial tab: the first module tab (restored — tabs are no longer
  // filtered by accessible_modules, every main module is always shown).
  useEffect(() => {
    if (userProfile && !tab) {
      setTab(Object.keys(MODULE_TABS)[0] || '')
    }
  }, [userProfile, tab])

  const load = useCallback(async () => {
    try {
      const [dashboardData, portfolioData, accountsData, watchlistData, collectionsData] = await Promise.all([
        api.dashboard ? api.dashboard() : Promise.resolve(null),
        api.portfolio(),
        api.accounts(),
        api.watchlist(),
        api.collections(),
      ])
      
      setData({
        dashboard: dashboardData,
        portfolio: portfolioData,
        accounts: accountsData,
        watchlist: watchlistData,
        collections: collectionsData,
      })
      setError(null)
    } catch (e) {
      setError(`Can't reach the API. (${e.message})`)
    }
  }, [])

  useEffect(() => {
    if (userProfile) {
      load()
    }
  }, [userProfile, load])

  const run = async (key, fn) => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(null) }
  }

  // Handle routing based on URL path
  const pathName = window.location.pathname

  // If not authenticated, show login or password reset pages
  if (!isAuthenticated) {
    if (pathName === '/password-reset-request') {
      return <PasswordResetRequest onSuccess={() => setIsAuthenticated(false)} />
    }
    if (pathName.startsWith('/password-reset-confirm/')) {
      const token = pathName.split('/').pop()
      return <PasswordResetConfirm onSuccess={() => setIsAuthenticated(false)} token={token} />
    }
    return <Login onLoginSuccess={(userData) => {
      setIsAuthenticated(true)
      if (userData) {
        setUserProfile(userData)
      }
    }} />
  }

  return (
    <>
      <Toaster />
      <header className="masthead">
        <h1>Credit Master</h1>
        <span className="sub">Origination · provisioning · monitoring · collections</span>
        <div className="spacer">
          <button className="btn ghost" disabled={busy || !userProfile} onClick={() => run('seed', api.seed)}>
            <Database size={16} /> {busy === 'seed' ? 'Seeding…' : 'Seed a book'}
          </button>
          <button className="btn ghost" disabled={busy || !userProfile} onClick={() => run('seedDashboard', api.seedDashboard)}>
            <Database size={16} /> {busy === 'seedDashboard' ? 'Seeding…' : 'Seed Dashboard'}
          </button>
          <button className="btn brass" disabled={busy || !userProfile} onClick={() => run('month', api.advanceMonth)}>
            <CalendarClock size={16} /> {busy === 'month' ? 'Running…' : 'Run a month'}
          </button>
          <button className="btn ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {isAuthenticated && !userProfile ? (
        <p className="p-6">Loading user profile...</p>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {Object.values(MODULE_TABS).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>

          {tab === 'origination' ? (
            /* Full-page module: owns the whole region below the tab bar
               (fixed left rail + scrollable content column) instead of
               living inside the centered <main> container. */
            <OriginatePage key={userProfile?.id} userProfile={userProfile} />
          ) : (
            <main>
              {error && <p className="error">{error}</p>}
              {tab === 'dashboard' && <Dashboard data={data.dashboard || data} userProfile={userProfile} />}
              {tab === 'portfolio' && <Portfolio data={data.portfolio} userProfile={userProfile} />}
              {tab === 'accounts' && <Accounts rows={data.accounts} userProfile={userProfile} />}
              {tab === 'watchlist' && <Watchlist rows={data.watchlist} userProfile={userProfile} />}
              {tab === 'collections' && <Collections rows={data.collections} userProfile={userProfile} />}
              {tab === 'policy' && <PolicyPack userProfile={userProfile} />}
              {tab === 'metrics' && <MetricsView module="origination" userProfile={userProfile} />}
            </main>
          )}
        </>
      )}

      {/* Session Expiry Timeout Warning Modal */}
{/* Session Expiry Timeout Warning Modal */}
      {showTimeoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 20, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            maxWidth: '440px',
            width: '90%',
            padding: '32px 28px',
            borderRadius: '20px',
            backgroundColor: '#f0f2f1', // Application background match
            // Soft neumorphic raised elevation
            boxShadow: '2px 2px 4px #d1d5d3, -2px -2px 4px #ffffff',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Soft inset icon container */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#f0f2f1',
              // Neumorphic recessed inner shadow for icon
              boxShadow: 'inset 4px 4px 8px #d1d5d3, inset -4px -4px 8px #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <Clock size={30} style={{ color: '#d9534f' }} />
            </div>

            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#1e3a2b', // Main dark green header text
              letterSpacing: '-0.01em',
            }}>
              Session Timeout Warning
            </h3>

            <p style={{
              margin: '0 0 24px 0',
              fontSize: '0.95rem',
              color: '#526058',
              lineHeight: '1.5',
            }}>
              Your session will expire in{' '}
              <span style={{
                display: 'inline-block',
                fontWeight: 700,
                color: '#1e3a2b',
                backgroundColor: '#e6eae8',
                padding: '2px 8px',
                borderRadius: '6px',
                // Subtle inset badge shadow for countdown number
                boxShadow: 'inset 4px 4px 8px #c8ccc9, inset -4px -4px 4px #ffffff',
              }}>
                {secondsRemaining}s
              </span>
              {/* . Would you like to stay logged in? */}
            </p>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '14px',
              width: '100%',
              marginTop: '8px',
            }}>
              {/* Logout Button (Outlined / Inset Neumorphic) */}
              <button
                onClick={handleLogout}
                disabled={isRefreshing}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  color: '#2d4738',
                  backgroundColor: '#f0f2f1',
                  border: '1px solid #cdd2cf',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  // Extruded soft shadow
                  boxShadow: '4px 4px 4px #d1d5d3, -4px -4px 8px #ffffff',
                  transition: 'all 0.2s ease',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow = 'inset 3px 3px 6px #d1d5d3, inset -3px -3px 6px #ffffff';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.boxShadow = '4px 4px 8px #d1d5d3, -4px -4px 8px #ffffff';
                }}
              >
                Logout
              </button>

              {/* Stay Logged In Button (Primary Gold Neumorphic) */}
              <button
                onClick={handleRefreshToken}
                disabled={isRefreshing}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  color: '#ffffff',
                  backgroundColor: '#b37e28', // App mustard-gold accent
                  border: 'none',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  // Soft colored directional highlight
                  boxShadow: '4px 4px 10px rgba(179, 126, 40, 0.35), -2px -2px 8px #ffffff',
                  transition: 'all 0.2s ease',
                  opacity: isRefreshing ? 0.7 : 1,
                }}
                onMouseDown={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.boxShadow = 'inset 3px 3px 6px rgba(0, 0, 0, 0.25)';
                  }
                }}
                onMouseUp={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.boxShadow = '4px 4px 10px rgba(179, 126, 40, 0.35), -2px -2px 8px #ffffff';
                  }
                }}
              >
                {isRefreshing ? 'Refreshing…' : 'Stay Logged In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}