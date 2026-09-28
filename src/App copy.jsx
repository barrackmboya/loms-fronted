import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, CalendarClock, Database, FileSignature,
  Landmark, LineChart, PhoneCall, Scale, BarChart2,
} from 'lucide-react'
import { api } from './lib/api'
import Originate from './views/Originate'
import Portfolio from './views/Portfolio'
import Accounts from './views/Accounts'
import Watchlist from './views/Watchlist'
import Collections from './views/Collections'
import PolicyPack from './views/PolicyPack'
import MetricsView from './views/MetricsView'
import Login from './views/Login'
import PasswordResetRequest from './views/PasswordResetRequest'
import PasswordResetConfirm from './views/PasswordResetConfirm'

// Module to tab mapping
const MODULE_TABS = {
  origination: { key: 'origination', label: 'Originate', icon: FileSignature },
  portfolio: { key: 'portfolio', label: 'Portfolio', icon: LineChart },
  accounts: { key: 'accounts', label: 'Accounts & Staging', icon: Landmark },
  watchlist: { key: 'watchlist', label: 'Early warning', icon: AlertTriangle },
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
      // If we don't have userProfile or accessible_modules, we cannot load data
      if (!userProfile) {
        setError('Unable to load data: user profile not available')
        return
      }
      if (!Array.isArray(userProfile.accessible_modules)) {
        setError('Unable to load data: user profile not available')
        return
      }

      // Only load data if user has access to relevant modules
      const [portfolioData, accountsData, watchlistData, collectionsData] = await Promise.all([
        userProfile.accessible_modules.includes('portfolio') ? api.portfolio() : Promise.resolve([]),
        userProfile.accessible_modules.includes('accounts') ? api.accounts() : Promise.resolve([]),
        userProfile.accessible_modules.includes('watchlist') ? api.watchlist() : Promise.resolve([]),
        userProfile.accessible_modules.includes('collections') ? api.collections() : Promise.resolve([]),
      ])
      setData({ portfolio: portfolioData, accounts: accountsData, watchlist: watchlistData, collections: collectionsData })
      setError(null)
    } catch (e) {
      setError(`Can't reach the API. (${e.message})`)
    }
  }, [userProfile, userProfile ? userProfile.accessible_modules : undefined])

  // Load data for the tabs when userProfile or accessible_modules change
  useEffect(() => {
    if (userProfile) {
      load()
    }
  }, [userProfile, userProfile ? userProfile.accessible_modules : undefined, load])

  const run = async (key, fn) => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(null) }
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userData')
    setIsAuthenticated(false)
    setUserProfile(null)
    setTab('')
  }

  // Handle routing based on URL path
  const pathName = window.location.pathname

  // If not authenticated, show login or password reset pages
  if (!isAuthenticated) {
    if (pathName === '/password-reset-request') {
      return <PasswordResetRequest onSuccess={() => {
        // Password reset requested - show message, don't log in
        setIsAuthenticated(false);
      }} />
    }
    if (pathName.startsWith('/password-reset-confirm/')) {
      // Extract token from URL (simplified)
      const token = pathName.split('/').pop()
      return <PasswordResetConfirm onSuccess={() => {
        // Password reset confirmed - redirect to login to enter new password
        setIsAuthenticated(false);
      }} token={token} />
    }
    // Default to login page
    return <Login onLoginSuccess={(userData) => {
      setIsAuthenticated(true)
      // Only set user profile if we received actual user data
      if (userData) {
        setUserProfile(userData)
      }
    }} />
  }

  // If authenticated, show the main app
  return (
    <>
      <header className="masthead">
        <h1>Credit Desk</h1>
        <span className="sub">Origination · provisioning · monitoring · collections</span>
        <div className="spacer">
          <button className="btn ghost" disabled={busy || !userProfile} onClick={() => run('seed', api.seed)}>
            <Database size={16} /> {busy === 'seed' ? 'Seeding…' : 'Seed a book'}
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
        // Loading state
        <p className="p-6">Loading user profile...</p>
      ) : userProfile && userProfile.accessible_modules && userProfile.accessible_modules.length === 0 ? (
        // No roles assigned yet
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>No roles assigned yet</h2>
          <p className="note">Please contact an administrator to assign modules to your role.</p>
        </div>
      ) : (
        // Show normal app with dynamic tabs
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
              return null; // Skip if module not in mapping
            })}
          </nav>

          <main>
            {error && <p className="error">{error}</p>}
            {tab === 'origination' && userProfile.accessible_modules.includes('origination') && <Originate onBooked={load} userProfile={userProfile} />}
            {tab === 'portfolio' && userProfile.accessible_modules.includes('portfolio') && <Portfolio data={data.portfolio} userProfile={userProfile} />}
            {tab === 'accounts' && userProfile.accessible_modules.includes('accounts') && <Accounts rows={data.accounts} userProfile={userProfile} />}
            {tab === 'watchlist' && userProfile.accessible_modules.includes('watchlist') && <Watchlist rows={data.watchlist} userProfile={userProfile} />}
            {tab === 'collections' && userProfile.accessible_modules.includes('collections') && <Collections rows={data.collections} userProfile={userProfile} />}
            {tab === 'policy' && userProfile.accessible_modules.includes('policy') && <PolicyPack userProfile={userProfile} />}
            {tab === 'metrics' && userProfile.accessible_modules.includes('metrics') && <MetricsView module="origination" userProfile={userProfile} />}
          </main>
        </>
      )}
    </>
  )
}