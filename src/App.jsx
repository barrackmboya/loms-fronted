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

const TABS = [
  { key: 'originate', label: 'Originate', icon: FileSignature },
  { key: 'portfolio', label: 'Portfolio', icon: LineChart },
  { key: 'accounts', label: 'Accounts & staging', icon: Landmark },
  { key: 'watchlist', label: 'Early warning', icon: AlertTriangle },
  { key: 'collections', label: 'Collections', icon: PhoneCall },
  { key: 'policy', label: 'Policy pack', icon: Scale },
  { key: 'metrics', label: 'Metrics', icon: BarChart2 },
]

export default function App() {
  const [tab, setTab] = useState('originate')
  const [data, setData] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [portfolio, accounts, watchlist, collections] = await Promise.all([
        api.portfolio(), api.accounts(), api.watchlist(), api.collections(),
      ])
      setData({ portfolio, accounts, watchlist, collections })
      setError(null)
    } catch (e) {
      setError(`Can't reach the API. Start Django on port 8000, then reload. (${e.message})`)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const run = async (key, fn) => {
    setBusy(key)
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(null) }
  }

  return (
    <>
      <header className="masthead">
        <h1>Credit Desk</h1>
        <span className="sub">Origination · provisioning · monitoring · collections</span>
        <div className="spacer">
          <button className="btn ghost" disabled={busy} onClick={() => run('seed', api.seed)}>
            <Database size={16} /> {busy === 'seed' ? 'Seeding…' : 'Seed a book'}
          </button>
          <button className="btn brass" disabled={busy} onClick={() => run('month', api.advanceMonth)}>
            <CalendarClock size={16} /> {busy === 'month' ? 'Running…' : 'Run a month'}
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      <main>
        {error && <p className="error">{error}</p>}
        {tab === 'originate' && <Originate onBooked={load} />}
        {tab === 'portfolio' && <Portfolio data={data.portfolio} />}
        {tab === 'accounts' && <Accounts rows={data.accounts} />}
        {tab === 'watchlist' && <Watchlist rows={data.watchlist} />}
        {tab === 'collections' && <Collections rows={data.collections} />}
        {tab === 'policy' && <PolicyPack />}
        {tab === 'metrics' && <MetricsView module="origination" />}
      </main>
    </>
  )
}
