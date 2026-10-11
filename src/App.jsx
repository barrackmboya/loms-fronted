import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, CalendarClock, Database, FileSignature,
  Landmark, LineChart, PhoneCall, Scale, BarChart2, LayoutDashboard, Clock, FileCheck2
} from 'lucide-react'
import { api } from './lib/api'
import Dashboard from './views/Dashboard'
import Originate from './views/Originate'
import Portfolio from './views/Portfolio'
import Accounts from './views/Accounts'
import Watchlist from './views/Watchlist'
import Collections from './views/Collections'
import PolicyPack from './views/PolicyPack'
import MetricsView from './views/MetricsView'
import DocumentVerification from './views/DocumentVerification'
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
  document_verification: { key: 'document_verification', label: 'Document Verification & Fraud', icon: FileCheck2 },
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
  const [documentSeed, setDocumentSeed] = useState(null)

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

  // Set initial tab based on user's accessible modules
  useEffect(() => {
    if (userProfile && userProfile.accessible_modules && userProfile.accessible_modules.length > 0) {
      // Find the first accessible module that is in MODULE_TABS
      const firstAccessibleTab = userProfile.accessible_modules.find(
        module => MODULE_TABS[module]
      );
      if (firstAccessibleTab) {
        setTab(firstAccessibleTab);
      } else {
        // Fallback to the first tab in MODULE_TABS if none of the accessible modules are in MODULE_TABS
        setTab(Object.keys(MODULE_TABS)[0] || '');
      }
    }
  }, [userProfile])

  const load = useCallback(async () => {
    try {
      if (!userProfile || !Array.isArray(userProfile.accessible_modules)) {
        setError('Unable to load data: user profile not available')
        return
      }

      const [dashboardData, portfolioData, accountsData, watchlistData, collectionsData] = await Promise.all([
        userProfile.accessible_modules.includes('dashboard') && api.dashboard ? api.dashboard() : Promise.resolve(null),
        userProfile.accessible_modules.includes('portfolio') ? api.portfolio() : Promise.resolve([]),
        userProfile.accessible_modules.includes('accounts') ? api.accounts() : Promise.resolve([]),
        userProfile.accessible_modules.includes('watchlist') ? api.watchlist() : Promise.resolve([]),
        userProfile.accessible_modules.includes('collections') ? api.collections() : Promise.resolve([]),
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
  }, [userProfile])

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

  const seedDocuments = async () => {
    setBusy('seedDocuments')
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/document-verification/seed/', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.detail || payload.error || `Seed failed (${response.status})`)
      setDocumentSeed(payload)
      setTab('document_verification')
    } catch (e) {
      setError(`Document seed failed: ${e.message}`)
    } finally {
      setBusy(null)
    }
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
          <button className="btn ghost" disabled={busy || !userProfile} onClick={seedDocuments}>
            <FileCheck2 size={16} /> {busy === 'seedDocuments' ? 'Seeding…' : 'Seed Documents'}
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
      ) : userProfile && userProfile.accessible_modules && userProfile.accessible_modules.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>No roles assigned yet</h2>
          <p className="note">Please contact an administrator to assign modules to your role.</p>
        </div>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {userProfile.accessible_modules.map((moduleName) => {
              const tabConfig = MODULE_TABS[moduleName];
              if (tabConfig) {
                return (
                  <button
                    key={moduleName}
                    role="tab"
                    aria-selected={tab === moduleName}
                    onClick={() => setTab(moduleName)}
                  >
                    <tabConfig.icon size={15} /> {tabConfig.label}
                  </button>
                );
              }
              return null;
            })}
          </nav>

          <main>
            {error && <p className="error">{error}</p>}
            {tab === 'dashboard' && userProfile.accessible_modules.includes('dashboard') && <Dashboard data={data.dashboard || data} userProfile={userProfile} />}
            {tab === 'origination' && userProfile.accessible_modules.includes('origination') && <Originate onBooked={load} userProfile={userProfile} />}
            {tab === 'portfolio' && userProfile.accessible_modules.includes('portfolio') && <Portfolio data={data.portfolio} userProfile={userProfile} />}
            {tab === 'accounts' && userProfile.accessible_modules.includes('accounts') && <Accounts rows={data.accounts} userProfile={userProfile} />}
            {tab === 'watchlist' && userProfile.accessible_modules.includes('watchlist') && <Watchlist rows={data.watchlist} userProfile={userProfile} />}
            {tab === 'collections' && userProfile.accessible_modules.includes('collections') && <Collections rows={data.collections} userProfile={userProfile} />}
            {tab === 'policy' && userProfile.accessible_modules.includes('policy') && <PolicyPack userProfile={userProfile} />}
            {tab === 'metrics' && userProfile.accessible_modules.includes('metrics') && <MetricsView module="origination" userProfile={userProfile} />}
            {tab === 'document_verification' && userProfile.accessible_modules.includes('document_verification') && (
              <DocumentVerification initialSeed={documentSeed} userProfile={userProfile} />
            )}
          </main>
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